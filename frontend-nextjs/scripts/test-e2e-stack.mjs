// End-to-end check of the whole stack on a real PostgreSQL database:
//   Java backend (JAVA_BACKEND_URL, default http://localhost:8080) in JDBC mode,
//   Next.js (TEST_BASE_URL, default http://localhost:3000), both on DATABASE_URL.
// Unlike test-ui-ux.mjs, which drives the mock store in-process, every step here goes through
// HTTP and is checked against the database. Rows it writes carry a run id and are deleted at the
// end; table states, on/off switches and settings it changes are put back. Existing data is not touched.
//
//   npm run test:e2e   (reads DATABASE_URL and AUTH_JWT_SECRET from the environment or .env.local;
//   Java also needs the frontend's AUTH_SERVICE_KEY for guests' online orders)
import { createHmac, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const JAVA = (process.env.JAVA_BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const NEXT = (process.env.TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const SECRET = process.env.AUTH_JWT_SECRET
if (!process.env.DATABASE_URL || !SECRET) {
  console.error('DATABASE_URL and AUTH_JWT_SECRET are required (the same values Java and Next.js run with).')
  process.exit(2)
}

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
const RUN = `E2E${Date.now().toString(36).toUpperCase()}`
const created = { orders: new Set(), reservations: new Set(), users: new Set(), menuIds: new Set(), phones: new Set() }

// --- helpers ---
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
// A session for an existing account, signed like the Java TokenService (HS256). Java re-reads the
// role from the users table, so this is exactly what a signed-in browser sends.
function sessionToken(userId) {
  const now = Math.floor(Date.now() / 1000)
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: String(userId), email: `${RUN}@test.local`, name: RUN, role: 'ADMIN', iat: now, exp: now + 3600 })}`
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`
}

let ADMIN = null
async function call(method, path, body, auth = ADMIN) {
  const res = await fetch(JAVA + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // not JSON
  }
  return { status: res.status, json, data: json?.data, text }
}
const brief = (r) => `${r.status} ${r.text.slice(0, 120)}`

const results = []
function check(id, name, ok, detail = '') {
  results.push({ id, ok: Boolean(ok) })
  console.log(`${ok ? '✅' : '❌'} [${id}] ${name}${detail ? ` (${detail})` : ''}`)
}

function cafeDateTime(daysAhead, hour, minute = 0) {
  const day = new Date(Date.now() + 7 * 3600e3 + daysAhead * 86400e3).toISOString().slice(0, 10)
  return `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+07:00`
}

// --- what the run may change, recorded before it starts ---
async function snapshot() {
  const tables = (await db.query('SELECT id, status, guest_count, occupied_since FROM tables')).rows
  const stock = (await db.query('SELECT id, in_stock FROM menu_items')).rows
  const adminStock = (await db.query('SELECT id, in_stock FROM admin_menu_items')).rows
  const config = (await call('GET', '/api/config')).data
  return { tables, stock, adminStock, config }
}

async function restore(before) {
  const codes = [...created.orders]
  await db.query('DELETE FROM orders WHERE order_code = ANY($1::text[])', [codes])
  // Online orders also live in the frontend store, with their contact and sync-queue rows.
  await db.query('DELETE FROM admin_orders WHERE order_code = ANY($1::text[])', [codes])
  await db.query('DELETE FROM admin_order_contacts WHERE order_code = ANY($1::text[])', [codes])
  await db.query('DELETE FROM admin_sync_queue WHERE order_code = ANY($1::text[])', [codes])
  await db.query('DELETE FROM reservations WHERE reservation_code = ANY($1::text[])', [[...created.reservations]])
  await db.query('DELETE FROM users WHERE email = ANY($1::text[])', [[...created.users]])
  await db.query('DELETE FROM customers WHERE phone = ANY($1::text[])', [[...created.phones]])
  await db.query('DELETE FROM menu_items WHERE id = ANY($1::int[])', [[...created.menuIds]])
  for (const t of before.tables) {
    await db.query('UPDATE tables SET status = $2, guest_count = $3, occupied_since = $4 WHERE id = $1', [t.id, t.status, t.guest_count, t.occupied_since])
  }
  for (const s of before.stock) {
    await db.query('UPDATE menu_items SET in_stock = $2 WHERE id = $1', [s.id, s.in_stock])
  }
  for (const s of before.adminStock) {
    await db.query('UPDATE admin_menu_items SET in_stock = $2 WHERE id = $1', [s.id, s.in_stock])
  }
  await db.query("SELECT setval(pg_get_serial_sequence('admin_orders', 'id'), COALESCE((SELECT MAX(id) FROM admin_orders), 0) + 1, false)")
  for (const table of ['menu_items', 'orders', 'reservations', 'customers', 'users']) {
    await db.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`)
  }
  if (before.config) {
    const { openingTime, closingTime } = before.config
    await call('PUT', '/api/config', { openingTime, closingTime })
  }
}

// The checkout page calls the placeOnlineOrder server action; its id comes from the build.
function onlineOrderActionId() {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.next/server/server-reference-manifest.json'), 'utf8')).node
    return Object.entries(manifest).find(([, entry]) => entry.exportedName === 'placeOnlineOrder')?.[0] ?? null
  } catch {
    return null
  }
}

// A shopper's browser: keeps the session and cart cookies between requests.
function shopperSession(sessionToken = null) {
  const jar = new Map(sessionToken ? [['dalatcafe_session', sessionToken]] : [])
  const header = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const keep = (res) => {
    for (const cookie of res.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(';')
      const at = pair.indexOf('=')
      if (pair.slice(at + 1) && !/Expires=Thu, 01 Jan 1970|Max-Age=0/i.test(cookie)) jar.set(pair.slice(0, at), pair.slice(at + 1))
      else jar.delete(pair.slice(0, at))
    }
  }
  return {
    async page(route) {
      return (await fetch(NEXT + route, { headers: { cookie: header() } })).text()
    },
    async cart(body) {
      const res = await fetch(`${NEXT}/api/cart`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: NEXT, cookie: header() }, body: JSON.stringify(body) })
      keep(res)
      return { status: res.status, json: await res.json() }
    },
    async placeOrder(actionId, input) {
      const res = await fetch(`${NEXT}/checkout`, {
        method: 'POST',
        headers: { 'Next-Action': actionId, 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'text/x-component', Origin: NEXT, cookie: header() },
        body: JSON.stringify([input]),
      })
      keep(res)
      const line = (await res.text()).split('\n').find((l) => l.startsWith('1:'))
      return line ? JSON.parse(line.slice(2)) : null
    },
  }
}

async function run() {
  // --- Auth & RBAC with real accounts ---
  let r = await call('GET', '/api/auth/me')
  check('AUTH-01', 'Bearer token resolves to the admin account in the database', r.status === 200 && r.data?.role === 'ADMIN', brief(r))
  r = await call('GET', '/api/orders', undefined, null)
  check('AUTH-02', 'Staff endpoint without a token is refused', r.status === 401, brief(r))
  const staffEmail = `${RUN.toLowerCase()}.staff@test.local`
  const staffPassword = `E2e${randomBytes(9).toString('base64url')}9`
  r = await call('POST', '/api/users', { email: staffEmail, name: `${RUN} Staff`, password: staffPassword, role: 'STAFF' })
  if (r.status === 201) created.users.add(staffEmail)
  check('AUTH-03', 'Admin creates a STAFF account', r.status === 201, `${r.status}`)
  r = await call('POST', '/api/auth/login', { email: staffEmail, password: staffPassword }, null)
  const STAFF = r.data?.token
  check('AUTH-04', 'Staff signs in with email and password', r.status === 200 && STAFF, `${r.status}`)
  r = await call('PUT', '/api/config', { storeName: 'x' }, STAFF)
  check('AUTH-05', 'Staff cannot change admin-only settings', r.status === 403, brief(r))

  // --- Menu & on/off switch ---
  r = await call('GET', '/api/menu', undefined, null)
  const menu = r.data ?? []
  check('MENU-01', 'Public menu is served', r.status === 200 && menu.length > 0, `${menu.length} items`)
  const itemName = `${RUN} Trà Atiso`
  r = await call('POST', '/api/menu', { name: itemName, category: 'Trà', kind: 'menu', sellPrice: 39000, costPrice: 12000, unit: 'ly' })
  const item = r.data
  if (item?.id) created.menuIds.add(item.id)
  check('MENU-02', 'Manager adds a menu item', r.status === 201 && item?.id, brief(r))
  const stored = item?.id ? (await db.query('SELECT name FROM menu_items WHERE id = $1', [item.id])).rows[0] : null
  if (stored?.name !== itemName) {
    throw new Error('Java did not write the new item to DATABASE_URL: it is not running in JDBC mode on this database')
  }
  check('MENU-03', 'The new item is stored in PostgreSQL', true)
  r = await call('POST', '/api/menu', { name: itemName.toLowerCase(), category: 'Trà', sellPrice: 1 })
  check('MENU-04', 'Duplicate name is refused', r.status === 409, brief(r))
  check('MENU-05', 'A new item is on sale and reports no quantity', item?.inStock === true && !('stockQty' in (item ?? {})), brief(r))
  r = await call('PATCH', `/api/menu/${item.id}/stock`, { change: -3 })
  check('MENU-06', 'Quantity changes are refused: stock is not tracked', r.status === 400, brief(r))
  r = await call('PATCH', `/api/menu/${item.id}/stock`, { inStock: false })
  check('MENU-07', 'An item can be switched off', r.status === 200 && r.data?.inStock === false, brief(r))
  await call('PATCH', `/api/menu/${item.id}/stock`, { inStock: true })

  // --- Tables ---
  r = await call('GET', '/api/tables')
  const free = (r.data ?? []).filter((t) => t.status === 'available').map((t) => t.id)
  check('TABLE-01', 'Floor plan is served with at least two free tables', r.status === 200 && free.length >= 2, `${free.length} free`)
  const [posTable, bookedTable] = free
  r = await call('PATCH', `/api/tables/${posTable}/status`, { status: 'occupied', guestCount: 2 })
  check('TABLE-02', 'Staff seats guests at a table', r.status === 200, brief(r))
  await call('PATCH', `/api/tables/${posTable}/status`, { status: 'available' })

  // --- Reservation (Chain of Responsibility) -> POS (Adapter) -> pay (Factory + Observer) ---
  const guest = `${RUN} Khách đặt bàn`
  r = await call('POST', '/api/reservations', { customer: guest, contact: '0900111222', dateTime: cafeDateTime(2, 9), tableId: bookedTable, guests: 2, preOrders: [{ menuItemId: menu[0].id, qty: 2 }] }, null)
  const resCode = r.data?.id
  if (resCode) created.reservations.add(resCode)
  check('RES-01', 'Guest books a table with pre-orders', r.status === 201 && resCode, brief(r))
  r = await call('POST', '/api/reservations', { customer: `${RUN} Trùng`, contact: '0900111333', dateTime: cafeDateTime(2, 9, 30), tableId: bookedTable, guests: 2 }, null)
  if (r.data?.id) created.reservations.add(r.data.id)
  check('RES-02', 'Overlapping booking on the same table is refused', r.status === 400, brief(r))
  r = await call('POST', '/api/reservations', { customer: `${RUN} Khuya`, contact: '0900111444', dateTime: cafeDateTime(2, 23, 30), tableId: bookedTable, guests: 2 }, null)
  if (r.data?.id) created.reservations.add(r.data.id)
  check('RES-03', 'Booking outside opening hours is refused', r.status === 400, brief(r))
  r = await call('PATCH', `/api/reservations/${resCode}/status`, { status: 'confirmed' })
  check('RES-04', 'Staff confirms the booking', r.status === 200, brief(r))
  r = await call('POST', `/api/reservations/${resCode}/transfer-pos`)
  check('RES-04A', 'Future booking cannot open a kitchen order', r.status === 409 && r.json?.code === 'RESERVATION_NOT_DUE', brief(r))
  // Advance only this run's booking to arrival; do not depend on the wall clock or opening hours.
  await db.query('UPDATE reservations SET date_time = NOW() WHERE reservation_code = $1 AND customer = $2', [resCode, guest])
  r = await call('POST', `/api/reservations/${resCode}/transfer-pos`)
  const bookingOrder = r.data?.orderCode
  if (bookingOrder) created.orders.add(bookingOrder)
  check('RES-05', 'Arrived guest is transferred to POS', r.status === 200 && bookingOrder, brief(r))
  r = await call('POST', `/api/reservations/${resCode}/transfer-pos`)
  check('RES-06', 'A booking is transferred only once', r.status === 409, brief(r))

  // --- Checkout (Facade, Decorator, Builder, Strategy, Factory, Observer) ---
  const latte = menu.find((m) => m.inStock) ?? menu[0]
  r = await call('POST', '/api/checkout', { customer: `${RUN} Khách`, tableId: posTable, orderType: 'dine-in', paymentMethod: 'card', voucherCode: 'WELCOME10', lines: [{ menuItemId: latte.id, qty: 2, size: 'L', toppings: ['cheese foam', 'trân châu'] }] })
  const dineIn = r.data
  if (dineIn?.orderCode) created.orders.add(dineIn.orderCode)
  check('POS-01', 'Dine-in checkout with size, toppings and WELCOME10', r.status === 200 && dineIn?.paymentStatus === 'paid' && dineIn.discountAmount > 0, brief(r))
  const row = dineIn?.orderCode ? (await db.query('SELECT payment_status, items FROM orders WHERE order_code = $1', [dineIn.orderCode])).rows[0] : null
  check('POS-02', 'Paid order and its lines are stored in PostgreSQL', row?.payment_status === 'PAID' && row.items?.[0]?.menuItemId === latte.id, row ? `${row.payment_status}` : 'missing')
  r = await call('GET', '/api/tables')
  check('POS-03', 'Paid dine-in order seats the table', r.data?.find((t) => t.id === posTable)?.status === 'occupied')
  r = await call('POST', '/api/checkout', { lines: [{ menuItemId: latte.id, qty: 1 }], orderType: 'pickup', paymentMethod: 'cash', tenderedAmount: 1000 })
  check('POS-04', 'Cash short of the total is refused before charging', r.status === 400, brief(r))
  r = await call('POST', '/api/checkout', { lines: [{ menuItemId: latte.id, qty: 1 }], tableId: 99999, paymentMethod: 'cash' })
  check('POS-05', 'Unknown table is refused before charging', r.status === 404, brief(r))
  await call('PATCH', `/api/menu/${item.id}/stock`, { inStock: false })
  r = await call('POST', '/api/checkout', { lines: [{ menuItemId: item.id, qty: 1 }], orderType: 'pickup', paymentMethod: 'qr' })
  check('POS-06', 'An item switched off is refused', r.status === 409, brief(r))
  await call('PATCH', `/api/menu/${item.id}/stock`, { inStock: true })
  r = await call('POST', '/api/checkout', { lines: [{ menuItemId: item.id, qty: 1 }], orderType: 'pickup', paymentMethod: 'cash', tenderedAmount: 100000 })
  const pickup = r.data
  if (pickup?.orderCode) created.orders.add(pickup.orderCode)
  check('POS-07', 'Cash pickup checkout returns change', r.status === 200 && pickup?.changeDue > 0, brief(r))

  // --- Kitchen display ---
  for (const status of ['brewing', 'ready', 'completed']) {
    r = await call('PATCH', `/api/orders/${dineIn?.orderCode}/status`, { status })
    check(`KDS-${status}`, `Order moves to ${status}`, r.status === 200, brief(r))
  }
  r = await call('GET', '/api/tables')
  check('KDS-table', 'Completed order sends the table to cleaning', r.data?.find((t) => t.id === posTable)?.status === 'cleaning')
  r = await call('PATCH', `/api/orders/${dineIn?.orderCode}/status`, { status: 'brewing' })
  check('KDS-closed', 'A completed order cannot be reopened', r.status === 409, brief(r))
  r = await call('PATCH', `/api/orders/${pickup?.orderCode}/status`, { status: 'cancelled' })
  check('KDS-refund', 'Cancelling a paid order refunds it', r.status === 200 && r.data?.paymentStatus === 'refunded', brief(r))

  // --- Paying the booking order ---
  r = await call('POST', `/api/orders/${bookingOrder}/pay`, { paymentMethod: 'qr' })
  check('PAY-01', 'Booking order is paid at the counter', r.status === 200, brief(r))
  r = await call('POST', `/api/orders/${bookingOrder}/pay`, { paymentMethod: 'qr' })
  check('PAY-02', 'An order cannot be paid twice', r.status === 409, brief(r))

  // --- Vouchers, offline sync, settings, analytics ---
  r = await call('POST', '/api/vouchers/validate', { code: 'welcome10', subtotal: 100000 }, null)
  check('VOUCHER', 'Voucher preview matches checkout', r.status === 200 && r.data?.valid && r.data?.discountAmount === 10000, brief(r))
  const offline = { orderCode: `AC-${RUN}-OFF`, customer: `${RUN} Offline`, orderType: 'pickup', paymentMethod: 'cash', paid: true, status: 'pending', createdAt: new Date().toISOString(), total: 48600, lines: [{ menuItemId: item.id, name: itemName, qty: 1, price: 39000, variation: null }] }
  created.orders.add(offline.orderCode)
  r = await call('POST', '/api/orders/sync', { orders: [offline] })
  check('SYNC-01', 'Offline order is imported', r.status === 200 && r.data?.created === 1, brief(r))
  r = await call('POST', '/api/orders/sync', { orders: [offline] })
  check('SYNC-02', 'Re-sending an offline order is idempotent', r.status === 200 && r.data?.existing === 1, brief(r))
  r = await call('PUT', '/api/config', { openingTime: '06:30' })
  check('CONFIG-01', 'Admin changes the opening time', r.status === 200 && r.data?.openingTime === '06:30', brief(r))
  r = await call('PUT', '/api/config', { openingTime: '23:30' })
  check('CONFIG-02', 'Opening after closing is refused', r.status === 400, brief(r))
  r = await call('GET', '/api/analytics/overview?days=7')
  check('ANALYTICS', 'Dashboard counts the paid orders', r.status === 200 && r.data?.paidOrders >= 3, `paidOrders=${r.data?.paidOrders}`)
  r = await call('GET', '/api/orders')
  const codes = new Set((r.data ?? []).map((o) => o.orderCode))
  check('ORDERS', 'Order list shows every order written', [dineIn?.orderCode, pickup?.orderCode, bookingOrder, offline.orderCode].every((c) => codes.has(c)))

  // --- Storefront online orders (server actions, as the checkout page calls them) ---
  const actionId = onlineOrderActionId()
  if (!actionId) {
    check('ONLINE', 'Online checkout (needs a production build: next build, next start)', false, '.next/server/server-reference-manifest.json not found')
  } else {
    const product = (await db.query("SELECT id, name FROM admin_menu_items WHERE kind = 'menu' AND in_stock ORDER BY id LIMIT 1")).rows[0]
    const productId = product?.id
    const guestShopper = shopperSession()
    const home = await guestShopper.page('/')
    check('ONLINE-01', 'Storefront lists the café menu', product && home.includes(product.name) && !home.includes('Nitro Cold Brew'), product?.name)
    r = await guestShopper.cart({ action: 'add', variantId: `gid://dalatcafe/ProductVariant/${productId}` })
    check('ONLINE-01b', 'A guest is asked to sign in before adding to the cart', r.status === 401 && r.json.loginRequired === true, `${r.status}`)

    // A customer signs up (Java) and shops with that session.
    const shopperEmail = `${RUN.toLowerCase()}.shopper@test.local`
    r = await call('POST', '/api/auth/register', { email: shopperEmail, name: `${RUN} Shopper`, password: 'Shopper2026!' }, null)
    if (r.status === 201) created.users.add(shopperEmail)
    const shopper = shopperSession(r.data?.token ?? null)
    const paidPhone = `09${String(Date.now()).slice(-8)}`
    const codPhone = `08${String(Date.now()).slice(-8)}`
    created.phones.add(paidPhone)
    created.phones.add(codPhone)
    r = await shopper.cart({ action: 'add', variantId: `gid://dalatcafe/ProductVariant/${productId}-L`, options: { Sugar: '50%' } })
    check('ONLINE-02', 'A drink in size L goes into the cart', r.status === 200 && r.json.lines?.nodes?.[0]?.merchandise?.title?.startsWith('Size L'), `${r.status}`)
    r = await shopper.cart({ action: 'add', variantId: 'gid://dalatcafe/ProductVariant/999999' })
    check('ONLINE-03', 'An unknown product is refused', r.status === 400)
    const paid = await shopper.placeOrder(actionId, { name: `${RUN} Online`, phone: paidPhone, fulfilment: 'delivery', address: '1 Lê Đại Hành, Đà Lạt', payment: 'vietqr' })
    if (paid?.orderCode) created.orders.add(paid.orderCode)
    check('ONLINE-04', 'A signed-in customer pays a VietQR delivery order', paid?.ok && paid.paid, JSON.stringify(paid))
    const javaPaid = (await db.query('SELECT payment_status, order_type FROM orders WHERE order_code = $1', [paid?.orderCode])).rows[0]
    const contact = (await db.query('SELECT phone, fulfilment FROM admin_order_contacts WHERE order_code = $1', [paid?.orderCode])).rows[0]
    check('ONLINE-05', 'Java has it paid for delivery; the contact is stored', javaPaid?.payment_status === 'PAID' && javaPaid.order_type === 'DELIVERY' && contact?.phone === paidPhone, JSON.stringify(javaPaid))
    const member = (await db.query('SELECT loyalty_points, total_orders, email FROM customers WHERE phone = $1', [paidPhone])).rows[0]
    check('ONLINE-05b', 'The paid order enrols the phone as a member and earns points', member?.loyalty_points > 0 && member.total_orders === 1 && member.email === shopperEmail, JSON.stringify(member))
    await shopper.cart({ action: 'add', variantId: `gid://dalatcafe/ProductVariant/${productId}` })
    const cod = await shopper.placeOrder(actionId, { name: `${RUN} COD`, phone: codPhone, fulfilment: 'pickup', payment: 'cod' })
    if (cod?.orderCode) created.orders.add(cod.orderCode)
    const javaCod = (await db.query('SELECT payment_status FROM orders WHERE order_code = $1', [cod?.orderCode])).rows[0]
    check('ONLINE-06', 'Cash on delivery reaches Java unpaid', cod?.ok && cod.paid === false && javaCod?.payment_status === 'UNPAID', JSON.stringify(cod))
    const codMember = (await db.query('SELECT 1 FROM customers WHERE phone = $1', [codPhone])).rows[0]
    check('ONLINE-06b', 'Cash on delivery earns no points (no member is created)', !codMember)
    // React separates adjacent text with <!-- --> in server HTML.
    const account = (await shopper.page('/account/orders')).replaceAll('<!-- -->', '')
    const sees = { paid: account.includes(paid?.orderCode), cod: account.includes(cod?.orderCode), points: account.includes(`${member?.loyalty_points} điểm`) }
    check('ONLINE-06c', 'The customer sees both orders and their points on /account', sees.paid && sees.cod && sees.points, JSON.stringify(sees))
    const ordersPage = await (await fetch(`${NEXT}/admin/orders`, { headers: { cookie: `dalatcafe_session=${ADMIN}` } })).text()
    check('ONLINE-07', 'Both orders are on the online orders page', ordersPage.includes(paid?.orderCode) && ordersPage.includes(cod?.orderCode))
  }

  // --- Next.js admin pages, signed in as the same admin ---
  // Bookings and accounts are read from Java; orders and menu pages read the frontend's admin_* store.
  const cookie = `dalatcafe_session=${ADMIN}`
  const pages = [
    ['/admin', null], ['/admin/pos', null], ['/admin/orders', null], ['/admin/menu', null], ['/admin/tables', null],
    ['/admin/customers', null], ['/admin/analytics', null], ['/admin/settings', null],
    ['/admin/reservations', guest], ['/admin/users', staffEmail],
  ]
  for (const [path, mustContain] of pages) {
    const res = await fetch(NEXT + path, { headers: { cookie }, redirect: 'manual' })
    const html = await res.text()
    check(`WEB ${path}`, `Admin page renders${mustContain ? ' with data read through Java' : ''}`, res.status === 200 && (!mustContain || html.includes(mustContain)), `${res.status}`)
  }
}

let before = null
let crashed = null
try {
  const admin = (await db.query("SELECT id FROM users WHERE role = 'ADMIN' AND active ORDER BY id LIMIT 1")).rows[0]
  if (!admin) throw new Error('No active ADMIN account in the database: start the Java backend once so it creates one')
  ADMIN = sessionToken(admin.id)
  before = await snapshot()
  await run()
} catch (error) {
  crashed = error
  console.error(`\n⚠️ ${error.message}`)
} finally {
  if (before) {
    try {
      await restore(before)
      console.log(`\nCleaned up run ${RUN}: removed ${created.orders.size} orders, ${created.reservations.size} bookings, ${created.users.size} accounts, ${created.menuIds.size} menu items; tables, on/off switches and opening hours restored.`)
    } catch (error) {
      crashed ??= error
      console.error(`⚠️ Cleanup failed, rows tagged ${RUN} may remain: ${error.message}`)
    }
  }
  await db.end()
}

const failed = results.filter((r) => !r.ok).length
console.log(`\nTotal ${results.length}, passed ${results.length - failed}, failed ${failed}`)
process.exit(crashed || failed ? 1 : 0)
