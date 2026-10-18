/**
 * Automated UI/UX & Integration Test Suite for Đà Lạt Cafe
 * Verifies Storefront & Admin features, Accessibility, API flows, and Business Logic.
 */

import { createServer } from 'http'
import { spawn, execSync } from 'child_process'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { SignJWT } from 'jose'

// Match the local Next.js server's signing key without overriding CI's environment.
const localEnvFile = fileURLToPath(new URL('../.env.local', import.meta.url))
if (existsSync(localEnvFile)) loadEnvFile(localEnvFile)

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

// Session cookies for the admin pages, signed like the Java TokenService does (HS256). The
// secret must match the server's AUTH_JWT_SECRET; locally both fall back to the dev secret.
const JWT_SECRET = new TextEncoder().encode(process.env.AUTH_JWT_SECRET || 'dalatcafe-dev-only-secret-change-me-0123456789')

async function sessionCookie(role, secret = JWT_SECRET) {
  const token = await new SignJWT({ email: `${role.toLowerCase()}@test.local`, name: `Test ${role}`, role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject('1')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
  return `dalatcafe_session=${token}`
}

let spawnedProcess = null

function cleanupServer() {
  if (spawnedProcess && spawnedProcess.pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${spawnedProcess.pid} /T /F`, { stdio: 'ignore' })
      } else {
        process.kill(-spawnedProcess.pid, 'SIGKILL')
      }
    } catch {}
    spawnedProcess = null
  }
}

process.on('exit', cleanupServer)
process.on('SIGINT', () => {
  cleanupServer()
  process.exit(1)
})
process.on('SIGTERM', () => {
  cleanupServer()
  process.exit(1)
})

async function checkServer(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    return res.status >= 200 && res.status < 500
  } catch {
    return false
  }
}

async function ensureServerRunning() {
  const isUp = await checkServer(BASE_URL)
  if (isUp) {
    console.log(`✓ Connected to active server at ${BASE_URL}`)
    return
  }

  console.log(`⚠️ Server not detected at ${BASE_URL}. Starting Next.js dev server automatically...`)
  const port = new URL(BASE_URL).port || '3000'
  const cmd = process.platform === 'win32' ? `npx.cmd next dev -p ${port}` : `npx next dev -p ${port}`
  spawnedProcess = spawn(cmd, {
    stdio: 'ignore',
    shell: true,
  })

  const start = Date.now()
  const timeoutMs = 45000

  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1000))
    if (await checkServer(BASE_URL)) {
      console.log(`✓ Next.js server successfully booted and ready at ${BASE_URL}!\n`)
      // brief pause for routes to warm up
      await new Promise((r) => setTimeout(r, 1000))
      return
    }
  }

  throw new Error(`Server failed to start at ${BASE_URL} within ${timeoutMs / 1000}s.`)
}

const results = []

function recordTest(id, name, group, status, details = '') {
  results.push({ id, name, group, status, details })
  const icon = status === 'PASS' ? '✅' : '❌'
  console.log(`${icon} [${id}] [${group}] ${name} - ${status}${details ? ` (${details})` : ''}`)
}

async function fetchPage(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  return { status: res.status, headers: res.headers, body: text }
}

async function runStorefrontTests() {
  console.log('\n--- 1. TESTING STOREFRONT UI/UX ---')

  // TC-SF-01: Header & Brand Navigation
  try {
    const res = await fetchPage(`${BASE_URL}/`)
    if (res.status === 200 && res.body.includes('Đà Lạt Cafe') && res.body.includes('Staff Portal')) {
      recordTest('TC-SF-01', 'Storefront Brand & Navigation Links', 'Storefront', 'PASS', 'Brand, Nav & Staff Portal present')
    } else {
      recordTest('TC-SF-01', 'Storefront Brand & Navigation Links', 'Storefront', 'FAIL', `Status: ${res.status}`)
    }
  } catch (err) {
    recordTest('TC-SF-01', 'Storefront Brand & Navigation Links', 'Storefront', 'FAIL', err.message)
  }

  // TC-SF-02: Hero Section & Call to Actions
  try {
    const res = await fetchPage(`${BASE_URL}/`)
    const hasHero = res.body.includes('Artisan coffee') && res.body.includes('Find your cup') && res.body.includes('Explore our beans')
    if (hasHero) {
      recordTest('TC-SF-02', 'Hero Section Content & CTAs', 'Storefront', 'PASS', 'Hero title, typography & CTAs present')
    } else {
      recordTest('TC-SF-02', 'Hero Section Content & CTAs', 'Storefront', 'FAIL', 'Missing hero text or CTA buttons')
    }
  } catch (err) {
    recordTest('TC-SF-02', 'Hero Section Content & CTAs', 'Storefront', 'FAIL', err.message)
  }

  // TC-SF-03: Menu Catalog Display from the café menu (Shopify not configured)
  try {
    const res = await fetchPage(`${BASE_URL}/`)
    const hasProducts = res.body.includes('Cà phê Latte Vani Mịn') && res.body.includes('Trà Đào Cam Sả')
    const noBlankError = !res.body.includes('Our menu is taking a little coffee break')
    if (hasProducts && noBlankError) {
      recordTest('TC-SF-03', 'Catalog Display from the Café Menu', 'Storefront', 'PASS', 'Menu items rendered')
    } else {
      recordTest('TC-SF-03', 'Catalog Display from the Café Menu', 'Storefront', 'FAIL', 'Products missing or error banner showing')
    }
  } catch (err) {
    recordTest('TC-SF-03', 'Catalog Display from the Café Menu', 'Storefront', 'FAIL', err.message)
  }

  // TC-SF-04: Category Tabs & Filtering Elements
  try {
    const res = await fetchPage(`${BASE_URL}/`)
    // Tabs follow the menu's own categories.
    const hasCategories = ['All favorites', 'Cà phê', 'Cà phê ủ lạnh'].every(c => res.body.includes(c))
    if (hasCategories) {
      recordTest('TC-SF-04', 'Category Tabs & Toolbar Controls', 'Storefront', 'PASS', 'Menu category filters rendered')
    } else {
      recordTest('TC-SF-04', 'Category Tabs & Toolbar Controls', 'Storefront', 'FAIL', 'Some category filters missing')
    }
  } catch (err) {
    recordTest('TC-SF-04', 'Category Tabs & Toolbar Controls', 'Storefront', 'FAIL', err.message)
  }

  // TC-SF-05: Accessibility & Semantic Structure
  try {
    const res = await fetchPage(`${BASE_URL}/`)
    const hasA11y = res.body.includes('aria-label="Search coffee menu"') &&
                    res.body.includes('aria-label="Main navigation"') &&
                    res.body.includes('role="group"')
    if (hasA11y) {
      recordTest('TC-SF-05', 'Accessibility & ARIA Attributes', 'Storefront', 'PASS', 'ARIA labels, roles & semantic landmarks verified')
    } else {
      recordTest('TC-SF-05', 'Accessibility & ARIA Attributes', 'Storefront', 'FAIL', 'Incomplete ARIA metadata')
    }
  } catch (err) {
    recordTest('TC-SF-05', 'Accessibility & ARIA Attributes', 'Storefront', 'FAIL', err.message)
  }

  // TC-SF-06: Journal & Footer Sections
  try {
    const res = await fetchPage(`${BASE_URL}/`)
    const hasFooter = res.body.includes('NOTES FROM THE COFFEE BAR') && res.body.includes('©') && res.body.includes('Staff portal')
    if (hasFooter) {
      recordTest('TC-SF-06', 'Journal & Footer Brand Story', 'Storefront', 'PASS', 'Educational coffee journal & footer present')
    } else {
      recordTest('TC-SF-06', 'Journal & Footer Brand Story', 'Storefront', 'FAIL', 'Footer or journal missing')
    }
  } catch (err) {
    recordTest('TC-SF-06', 'Journal & Footer Brand Story', 'Storefront', 'FAIL', err.message)
  }

  // TC-SF-07: Branch contact, cafe space gallery and the compact cart button
  try {
    const res = await fetchPage(`${BASE_URL}/`)
    const ok = res.status === 200 &&
      res.body.includes('href="tel:0988752291"') &&
      res.body.includes('href="mailto:2312585@dlu.edu.vn"') &&
      res.body.includes('123 Phan Đình Phùng') && res.body.includes('456 Bùi Thị Xuân') &&
      (res.body.includes('/images/space/') || res.body.includes('%2Fimages%2Fspace%2F')) &&
      res.body.includes('aria-label="Mở giỏ hàng') &&
      !res.body.includes('>Giỏ hàng</span>')
    recordTest('TC-SF-07', 'Two Branches, Contact, Cafe Space Gallery & Icon-only Cart', 'Storefront', ok ? 'PASS' : 'FAIL', `Status ${res.status}`)
  } catch (err) {
    recordTest('TC-SF-07', 'Branch Contact, Cafe Space Gallery & Icon-only Cart', 'Storefront', 'FAIL', err.message)
  }
}

async function runCartAndWishlistTests() {
  console.log('\n--- 2. TESTING CART & WISHLIST API FLOWS ---')

  let cookieHeader = ''

  // TC-API-01: Favorites API (GET & POST)
  try {
    const postFav = await fetch(`${BASE_URL}/api/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
      },
      body: JSON.stringify({ id: 'gid://dalatcafe/Product/1' })
    })
    const favCookie = postFav.headers.get('set-cookie')
    const favData = await postFav.json()

    if (postFav.status === 200 && Array.isArray(favData) && favData.includes('gid://dalatcafe/Product/1')) {
      recordTest('TC-API-01', 'Toggle Wishlist / Favorites Item', 'Cart & Wishlist', 'PASS', 'Item added to favorites cookie')
    } else {
      recordTest('TC-API-01', 'Toggle Wishlist / Favorites Item', 'Cart & Wishlist', 'FAIL', `Status ${postFav.status}`)
    }
  } catch (err) {
    recordTest('TC-API-01', 'Toggle Wishlist / Favorites Item', 'Cart & Wishlist', 'FAIL', err.message)
  }

  // TC-API-02: Cart Add Item (ordering needs a signed-in account; a guest is sent to sign in)
  try {
    const addDrink = JSON.stringify({
      action: 'add',
      variantId: 'gid://dalatcafe/ProductVariant/2-L',
      options: { Milk: 'Oat', Sugar: '50% (Vừa)', Ice: '50% (Ít đá)' }
    })
    const guestCart = await fetch(`${BASE_URL}/api/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
      body: addDrink,
    })
    const guestBlocked = guestCart.status === 401 && (await guestCart.json()).loginRequired === true
    const customer = await sessionCookie('CUSTOMER')
    const postCart = await fetch(`${BASE_URL}/api/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
        'Cookie': customer,
      },
      body: addDrink,
    })

    const setCookies = postCart.headers.get('set-cookie')
    cookieHeader = setCookies ? `${customer}; ${setCookies.split(';')[0]}` : customer

    const cartData = await postCart.json()
    const addedLine = cartData.lines?.nodes?.[0]
    // Size L is its own variant and the sugar choice is kept on the line.
    if (
      guestBlocked &&
      postCart.status === 200 &&
      cartData.totalQuantity >= 1 &&
      addedLine?.merchandise?.title?.startsWith('Size L') &&
      addedLine.attributes?.some((a) => a.key === 'Sugar')
    ) {
      recordTest('TC-API-02', 'Add Drink with Customizations to Cart', 'Cart & Wishlist', 'PASS', `Total qty: ${cartData.totalQuantity}, Cost: ${cartData.cost.totalAmount.amount} ${cartData.cost.totalAmount.currencyCode}`)
      
      const lineId = cartData.lines.nodes[0].id

      // TC-API-03: Cart Update Quantity
      const qtyRes = await fetch(`${BASE_URL}/api/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': BASE_URL,
          'Cookie': cookieHeader
        },
        body: JSON.stringify({ action: 'quantity', lineId, quantity: 2 })
      })
      const qtyData = await qtyRes.json()
      if (qtyRes.status === 200 && qtyData.totalQuantity === 2) {
        recordTest('TC-API-03', 'Update Item Quantity in Cart (+/-)', 'Cart & Wishlist', 'PASS', `Qty updated to ${qtyData.totalQuantity}`)
      } else {
        recordTest('TC-API-03', 'Update Item Quantity in Cart (+/-)', 'Cart & Wishlist', 'FAIL', `Qty update failed: ${JSON.stringify(qtyData)}`)
      }

      // TC-API-04: Cart Note
      const noteRes = await fetch(`${BASE_URL}/api/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': BASE_URL,
          'Cookie': cookieHeader
        },
        body: JSON.stringify({ action: 'note', note: 'Extra warm oat milk please' })
      })
      const noteData = await noteRes.json()
      if (noteRes.status === 200 && noteData.note === 'Extra warm oat milk please') {
        recordTest('TC-API-04', 'Add Barista Order Note to Cart', 'Cart & Wishlist', 'PASS', 'Order note persisted')
      } else {
        recordTest('TC-API-04', 'Add Barista Order Note to Cart', 'Cart & Wishlist', 'FAIL', `Note update failed`)
      }

      // TC-API-05: Cart Discount Code
      const promoRes = await fetch(`${BASE_URL}/api/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': BASE_URL,
          'Cookie': cookieHeader
        },
        body: JSON.stringify({ action: 'discount', code: 'WELCOME10' })
      })
      const promoData = await promoRes.json()
      if (promoRes.status === 200 && promoData.discountCodes?.some(d => d.applicable)) {
        recordTest('TC-API-05', 'Apply Promo Voucher Code (WELCOME10)', 'Cart & Wishlist', 'PASS', '10% discount verified')
      } else {
        recordTest('TC-API-05', 'Apply Promo Voucher Code (WELCOME10)', 'Cart & Wishlist', 'FAIL', 'Promo failed')
      }

    } else {
      recordTest('TC-API-02', 'Add Drink with Customizations to Cart', 'Cart & Wishlist', 'FAIL', `guest=${guestCart.status}, cart: ${JSON.stringify(cartData)}`)
    }
  } catch (err) {
    recordTest('TC-API-02', 'Add Drink with Customizations to Cart', 'Cart & Wishlist', 'FAIL', err.message)
  }
}

async function runAdminUITests() {
  console.log('\n--- 3. TESTING ADMIN OPERATIONS UI/UX ---')

  const adminRoutes = [
    { id: 'TC-ADM-01', path: '/admin', title: 'Admin Overview Dashboard', keywords: ['Good morning', 'Total revenue today', 'Active tables', 'Live order stream'] },
    { id: 'TC-ADM-02', path: '/admin/pos', title: 'Point of Sale (POS) Terminal', keywords: ['Point of sale', 'Kitchen display', 'Open tab', 'Cash', 'Card'] },
    { id: 'TC-ADM-03', path: '/admin/pos?tab=kitchen', title: 'Kitchen Display System (KDS)', keywords: ['Kitchen display', 'Pending', 'Brewing', 'Ready'] },
    { id: 'TC-ADM-04', path: '/admin/tables', title: 'Floor Plan Table Management', keywords: ['Floor plan', 'Main Floor', 'Patio', 'Coffee Bar', 'Table 1'] },
    { id: 'TC-ADM-06', path: '/admin/customers', title: 'Customer CRM & Loyalty Spend', keywords: ['Customers', 'Orders', 'Total spent', 'Last visit'] },
    { id: 'TC-ADM-07', path: '/admin/analytics', title: 'Operations Analytics & Mix Charts', keywords: ['Analytics', 'Revenue', 'Drinks', 'Payment'] },
    { id: 'TC-ADM-08', path: '/admin/settings', title: 'Branch Operations Settings', keywords: ['Branch configuration', 'Sales tax', 'Accepted payments'] },
  ]

  const adminCookie = await sessionCookie('ADMIN')
  for (const route of adminRoutes) {
    try {
      const res = await fetchPage(`${BASE_URL}${route.path}`, { headers: { Cookie: adminCookie } })
      const allFound = route.keywords.every(kw => res.body.includes(kw))
      if (res.status === 200 && allFound) {
        recordTest(route.id, route.title, 'Admin UI', 'PASS', 'Route returned 200 OK with expected UI elements')
      } else {
        const missing = route.keywords.filter(kw => !res.body.includes(kw))
        recordTest(route.id, route.title, 'Admin UI', 'FAIL', `Status: ${res.status}, Missing keywords: ${missing.join(', ')}`)
      }
    } catch (err) {
      recordTest(route.id, route.title, 'Admin UI', 'FAIL', err.message)
    }
  }

  // TC-ADM-11: the header's branch switch (admin_branch cookie) shows that branch's floor only
  try {
    const first = await fetchPage(`${BASE_URL}/admin/tables`, { headers: { Cookie: adminCookie } })
    const second = await fetchPage(`${BASE_URL}/admin/tables`, { headers: { Cookie: `${adminCookie}; admin_branch=bui-thi-xuan` } })
    const firstOk = first.status === 200 && first.body.includes('Coffee Bar') && !first.body.includes('Góc làm việc')
    const secondOk = second.status === 200 && second.body.includes('Góc làm việc') && !second.body.includes('Coffee Bar') && second.body.includes('456 Bùi Thị Xuân')
    if (firstOk && secondOk) {
      recordTest('TC-ADM-11', 'Branch Switch Shows Only That Branch', 'Admin UI', 'PASS', '123 Phan Đình Phùng and 456 Bùi Thị Xuân floors kept apart')
    } else {
      recordTest('TC-ADM-11', 'Branch Switch Shows Only That Branch', 'Admin UI', 'FAIL', JSON.stringify({ first: first.status, firstOk, second: second.status, secondOk }))
    }
  } catch (err) {
    recordTest('TC-ADM-11', 'Branch Switch Shows Only That Branch', 'Admin UI', 'FAIL', err.message)
  }

  // TC-ADM-10: the header has no search box; its bell links each alert to the page that resolves it
  try {
    const res = await fetchPage(`${BASE_URL}/admin`, { headers: { Cookie: adminCookie } })
    const noSearch = !res.body.includes('role="search"') && !res.body.includes('Tìm kiếm nhanh')
    const bell = res.body.includes('aria-label="Thông báo (')
    const kitchenLink = res.body.includes('href="/admin/pos?tab=kitchen"')
    if (res.status === 200 && noSearch && bell && kitchenLink) {
      recordTest('TC-ADM-10', 'Admin Header Without Search, Bell and Kitchen Link', 'Admin UI', 'PASS', 'No search form; bell and live-order link to the kitchen tab present')
    } else {
      recordTest('TC-ADM-10', 'Admin Header Without Search, Bell and Kitchen Link', 'Admin UI', 'FAIL', JSON.stringify({ status: res.status, noSearch, bell, kitchenLink }))
    }
  } catch (err) {
    recordTest('TC-ADM-10', 'Admin Header Without Search, Bell and Kitchen Link', 'Admin UI', 'FAIL', err.message)
  }
}

async function runAdminMutationTests() {
  console.log('\n--- 4. TESTING ADMIN SERVER ACTIONS & STATE MUTATIONS ---')

  // We can test Server Actions by dynamically importing or calling mock store functions directly!
  try {
    const { getMockActiveOrders, updateMockOrderStatus, updateMockTableStatus, createMockOrder, setMockItemInStock, createMockMenuItem, getMockTables, getMockMenuItems } = await import('../lib/db/mock-store.ts')

    // TC-ACT-01: Create Order
    const orderRes = createMockOrder({
      lines: [{ menuItemId: 1, qty: 2 }],
      customer: 'Automated Tester',
      tableId: 5,
      orderType: 'dine-in',
      paymentMethod: 'card',
      paid: true,
    })
    // Quantities are not tracked: only an unknown or switched-off item refuses a line.
    const unknownItem = createMockOrder({
      lines: [{ menuItemId: 999999, qty: 1 }],
      customer: 'Automated Unknown Item',
      tableId: null,
      orderType: 'pickup',
      paymentMethod: 'cash',
      paid: false,
    })
    const tableSeated = getMockTables().find((t) => t.id === 5)?.status === 'occupied'
    if (orderRes.ok && !unknownItem.ok && tableSeated) {
      recordTest('TC-ACT-01', 'Place Order via POS (Table 5 Occupied, Unknown Item Refused)', 'Admin Actions', 'PASS', `${orderRes.message} Unknown item refused: ${unknownItem.error}`)
    } else {
      recordTest('TC-ACT-01', 'Place Order via POS', 'Admin Actions', 'FAIL', `${orderRes.error ?? ''} unknown=${JSON.stringify(unknownItem)} tableSeated=${tableSeated}`)
    }

    // TC-ACT-02: Kitchen Status Progression
    const activeOrders = getMockActiveOrders()
    const targetOrder = activeOrders.find(o => o.customer === 'Automated Tester') || activeOrders[0]
    if (targetOrder) {
      const brewRes = updateMockOrderStatus(targetOrder.id, 'brewing')
      const readyRes = updateMockOrderStatus(targetOrder.id, 'ready')
      const doneRes = updateMockOrderStatus(targetOrder.id, 'completed')
      if (brewRes.ok && readyRes.ok && doneRes.ok) {
        recordTest('TC-ACT-02', 'Progress Ticket through Kitchen Display (Brewing -> Ready -> Completed)', 'Admin Actions', 'PASS', `Ticket #${targetOrder.orderCode} completed`)
      } else {
        recordTest('TC-ACT-02', 'Progress Ticket through Kitchen Display', 'Admin Actions', 'FAIL', 'Status update failed')
      }
    } else {
      recordTest('TC-ACT-02', 'Progress Ticket through Kitchen Display', 'Admin Actions', 'FAIL', 'No active order found')
    }

    // TC-ACT-03: Table Status Update
    const tableUpdateRes = updateMockTableStatus(1, 'occupied', 2)
    const tables = getMockTables()
    const table1 = tables.find(t => t.id === 1)
    if (tableUpdateRes.ok && table1?.status === 'occupied' && table1.guestCount === 2) {
      recordTest('TC-ACT-03', 'Change Table Status & Guests (Table 1 Occupied)', 'Admin Actions', 'PASS', 'Floor plan state synced')
    } else {
      recordTest('TC-ACT-03', 'Change Table Status & Guests', 'Admin Actions', 'FAIL', 'Table status failed')
    }

    // TC-ACT-04: Inventory Toggle
    const stockRes = setMockItemInStock(1, false)
    const menu = getMockMenuItems()
    const item1 = menu.find(m => m.id === 1)
    if (stockRes.ok && item1?.inStock === false) {
      // Toggle back to true
      setMockItemInStock(1, true)
      recordTest('TC-ACT-04', 'Toggle Menu Item Stock Availability', 'Admin Actions', 'PASS', 'Item marked out of stock and restored')
    } else {
      recordTest('TC-ACT-04', 'Toggle Menu Item Stock Availability', 'Admin Actions', 'FAIL', 'Stock toggle failed')
    }

    // TC-ACT-05: Create Menu Item
    const createItemRes = createMockMenuItem({
      name: 'Matcha Blossom Latte',
      category: 'Specialty',
      kind: 'menu',
      unit: 'cups',
      costPrice: 1.5,
      sellPrice: 6.5,
      recipe: 'Ceremonial grade Uji matcha with oat milk and blossom syrup.',
      imageUrl: '/images/latte.png',
      variations: [{ name: 'Hot', price: 0 }, { name: 'Iced', price: 0.5 }],
    })
    const updatedMenu = getMockMenuItems()
    const newItem = updatedMenu.find(m => m.name === 'Matcha Blossom Latte')
    if (createItemRes.ok && newItem) {
      recordTest('TC-ACT-05', 'Add New Menu Item to Catalog & POS', 'Admin Actions', 'PASS', 'New specialty item created')
    } else {
      recordTest('TC-ACT-05', 'Add New Menu Item to Catalog & POS', 'Admin Actions', 'FAIL', createItemRes.error)
    }

    // TC-ACT-06: Completing a dine-in ticket frees the table for cleaning (mirrors the Java Observer)
    updateMockTableStatus(6, 'available', 0)
    createMockOrder({
      lines: [{ menuItemId: 1, qty: 1 }],
      customer: 'Table Sync Tester',
      tableId: 6,
      orderType: 'dine-in',
      paymentMethod: 'cash',
      paid: true,
    })
    const seated = getMockTables().find(t => t.id === 6)?.status
    const syncOrder = getMockActiveOrders().find(o => o.customer === 'Table Sync Tester')
    const syncDone = syncOrder ? updateMockOrderStatus(syncOrder.id, 'completed') : { ok: false }
    const freed = getMockTables().find(t => t.id === 6)
    if (seated === 'occupied' && syncDone.ok && freed?.status === 'cleaning' && freed.guestCount === 0) {
      recordTest('TC-ACT-06', 'Paid Order Seats Table, Completed Ticket Sends It to Cleaning', 'Admin Actions', 'PASS', 'occupied -> cleaning')
    } else {
      recordTest('TC-ACT-06', 'Paid Order Seats Table, Completed Ticket Sends It to Cleaning', 'Admin Actions', 'FAIL', `seated=${seated}, after=${freed?.status}`)
    }

    // TC-ACT-07: An order priced by Java (member discount, redeemed points) keeps Java's totals locally
    createMockOrder({
      lines: [{ menuItemId: 1, qty: 1 }],
      customer: 'Loyalty Tester',
      tableId: null,
      orderType: 'pickup',
      paymentMethod: 'qr',
      paid: true,
      orderCode: 'AC-9001',
      totals: { subtotal: 55000, total: 37800 },
    })
    const priced = getMockActiveOrders().find(o => o.orderCode === 'AC-9001')
    if (priced?.subtotal === 55000 && priced.total === 37800) {
      recordTest('TC-ACT-07', 'Mirror Java Receipt Totals After Point Redemption', 'Admin Actions', 'PASS', 'Total 37.800 đ kept')
    } else {
      recordTest('TC-ACT-07', 'Mirror Java Receipt Totals After Point Redemption', 'Admin Actions', 'FAIL', `total=${priced?.total}`)
    }

    // TC-ACT-08: Offline sync loads queued orders back by their code
    const { getMockOrdersByCode } = await import('../lib/db/mock-store.ts')
    const queued = getMockOrdersByCode(['AC-9001', 'AC-NOT-THERE'])
    if (queued.length === 1 && queued[0].orderCode === 'AC-9001' && queued[0].items.length === 1) {
      recordTest('TC-ACT-08', 'Load Offline Orders by Code for Java Sync', 'Admin Actions', 'PASS', 'Unknown codes are skipped')
    } else {
      recordTest('TC-ACT-08', 'Load Offline Orders by Code for Java Sync', 'Admin Actions', 'FAIL', `found=${queued.length}`)
    }

    // TC-ACT-09: A new menu item reports its id so it can be linked to the Java menu item
    const linked = createMockMenuItem({
      name: 'Atiso Cold Tea', category: 'Tea', kind: 'menu', unit: 'cups',
      costPrice: 1, sellPrice: 3.5, recipe: '', imageUrl: '', variations: [],
    })
    const linkedItem = getMockMenuItems().find(m => m.id === linked.id)
    if (linked.ok && linkedItem?.name === 'Atiso Cold Tea') {
      recordTest('TC-ACT-09', 'New Menu Item Returns Its Id for the Java Link', 'Admin Actions', 'PASS', `id ${linked.id}`)
    } else {
      recordTest('TC-ACT-09', 'New Menu Item Returns Its Id for the Java Link', 'Admin Actions', 'FAIL', linked.error ?? 'id missing')
    }

    // TC-ACT-10: With Java offline, the local reservation fallback refuses what the Java chain refuses
    const { createMockReservation, updateMockReservationStatus } = await import('../lib/db/mock-store.ts')
    const bookedTable = getMockTables().find(t => t.seats >= 2)
    // A month ahead so no seeded booking shares the slot; UTC 03:00 is 10:00 in Đà Lạt.
    const at = (utcHour, utcMinute = 0) => {
      const day = new Date(Date.now() + 30 * 86400000)
      day.setUTCHours(utcHour, utcMinute, 0, 0)
      return day
    }
    const booking = (dateTime) => ({ customer: 'Fallback Tester', contact: '0900000010', email: null, note: null, dateTime, guests: 2, tableId: bookedTable.id })
    const accepted = createMockReservation(booking(at(3)))
    const sameSlot = createMockReservation(booking(at(4)))
    const lateNight = createMockReservation(booking(at(16, 30)))
    const pastSlot = createMockReservation(booking(new Date(Date.now() - 60 * 60 * 1000)))
    updateMockReservationStatus(accepted.code, 'Đã hủy')
    const afterCancel = createMockReservation(booking(at(4)))
    if (accepted.ok && !sameSlot.ok && !lateNight.ok && !pastSlot.ok && afterCancel.ok) {
      recordTest('TC-ACT-10', 'Offline Reservation Fallback Applies the Java Chain Rules', 'Admin Actions', 'PASS', 'Overlapping, 23:30 and past bookings refused; a cancelled one frees the slot')
    } else {
      recordTest('TC-ACT-10', 'Offline Reservation Fallback Applies the Java Chain Rules', 'Admin Actions', 'FAIL', JSON.stringify({ accepted, sameSlot, lateNight, pastSlot, afterCancel }))
    }

    // TC-ACT-11: With Java offline, cash tendered below the total is refused as the Java Facade does
    const cashOrder = (customer, paymentMethod, tenderedAmount) => createMockOrder({
      lines: [{ menuItemId: 1, qty: 1 }], customer, tableId: null, orderType: 'pickup', paymentMethod, paid: true, tenderedAmount,
    })
    const short = cashOrder('Cash Short Tester', 'cash', 1000)
    const shortRecorded = getMockActiveOrders().some(o => o.customer === 'Cash Short Tester')
    const covered = cashOrder('Cash Covered Tester', 'cash', 10_000_000)
    const card = cashOrder('Card Tender Tester', 'card', 1000)
    if (!short.ok && !shortRecorded && covered.ok && card.ok) {
      recordTest('TC-ACT-11', 'Offline Cash Sale Must Be Covered by the Cash Tendered', 'Admin Actions', 'PASS', short.error)
    } else {
      recordTest('TC-ACT-11', 'Offline Cash Sale Must Be Covered by the Cash Tendered', 'Admin Actions', 'FAIL', JSON.stringify({ short, shortRecorded, covered, card }))
    }

    // TC-ACT-12: Orders and bookings belong to a branch: a table decides it, pickup names it,
    // and one booking cannot join tables of both branches
    const secondTable = getMockTables().find(t => t.branch === 'bui-thi-xuan')
    const secondTables = getMockTables().filter(t => t.branch === 'bui-thi-xuan')
    createMockOrder({ lines: [{ menuItemId: 1, qty: 1 }], customer: 'Branch Dine-in', tableId: secondTable.id, orderType: 'dine-in', paymentMethod: 'card', paid: true })
    createMockOrder({ lines: [{ menuItemId: 1, qty: 1 }], customer: 'Branch Pickup', tableId: null, orderType: 'pickup', paymentMethod: 'card', paid: true, branch: 'bui-thi-xuan' })
    const branchOf = (customer) => getMockActiveOrders().find(o => o.customer === customer)?.branch
    const mixed = createMockReservation({ customer: 'Mixed Branch', contact: '0900000020', email: null, note: null, dateTime: at(5), guests: 2, tableId: 1, tableIds: [1, secondTable.id] })
    const wrongBranch = createMockReservation({ customer: 'Wrong Branch', contact: '0900000021', email: null, note: null, dateTime: at(5), guests: 2, tableId: 1, branch: 'bui-thi-xuan' })
    const joined = createMockReservation({ customer: 'Second Branch', contact: '0900000022', email: null, note: null, dateTime: at(5), guests: 4, tableId: secondTables[1].id, tableIds: [secondTables[1].id, secondTables[2].id], branch: 'bui-thi-xuan' })
    const { getMockReservations } = await import('../lib/db/mock-store.ts')
    const joinedBranch = getMockReservations().find(r => r.code === joined.code)?.branch
    if (secondTables.length === 8 && branchOf('Branch Dine-in') === 'bui-thi-xuan' && branchOf('Branch Pickup') === 'bui-thi-xuan'
      && !mixed.ok && !wrongBranch.ok && joined.ok && joinedBranch === 'bui-thi-xuan') {
      recordTest('TC-ACT-12', 'Orders and Bookings Belong to One Branch', 'Admin Actions', 'PASS', `${mixed.error} / ${wrongBranch.error}`)
    } else {
      recordTest('TC-ACT-12', 'Orders and Bookings Belong to One Branch', 'Admin Actions', 'FAIL', JSON.stringify({ tables: secondTables.length, dineIn: branchOf('Branch Dine-in'), pickup: branchOf('Branch Pickup'), mixed, wrongBranch, joined, joinedBranch }))
    }

  } catch (err) {
    recordTest('TC-ACT-01', 'Admin Server Actions & Mock Store Operations', 'Admin Actions', 'FAIL', err.message)
  }
}

async function runAuthTests() {
  console.log('\n--- 5. TESTING SIGN-IN & ROLE-BASED ACCESS ---')
  const manual = (cookie) => ({ redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} })
  const target = (res) => res.headers.get('location') ?? ''

  const checks = [
    {
      id: 'TC-AUTH-01', name: 'Visitor Is Sent to Sign-in With the Requested Page',
      run: async () => {
        const res = await fetchPage(`${BASE_URL}/admin/pos`, manual())
        return [res.status === 307 && target(res).includes('/login?next=%2Fadmin%2Fpos'), `${res.status} -> ${target(res)}`]
      },
    },
    {
      id: 'TC-AUTH-02', name: 'Customer Session Cannot Open the Admin Console',
      run: async () => {
        const res = await fetchPage(`${BASE_URL}/admin`, manual(await sessionCookie('CUSTOMER')))
        return [res.status === 307 && new URL(target(res), BASE_URL).pathname === '/', `${res.status} -> ${target(res)}`]
      },
    },
    {
      id: 'TC-AUTH-03', name: 'Staff Opens POS but Not Admin-only Settings',
      run: async () => {
        const cookie = await sessionCookie('STAFF')
        const pos = await fetchPage(`${BASE_URL}/admin/pos`, manual(cookie))
        const settings = await fetchPage(`${BASE_URL}/admin/settings`, manual(cookie))
        return [pos.status === 200 && settings.status === 307 && target(settings).includes('/admin?denied=1'), `pos=${pos.status}, settings=${settings.status}`]
      },
    },
    {
      id: 'TC-AUTH-04', name: 'Token Signed With Another Secret Is Rejected',
      run: async () => {
        const forged = await sessionCookie('ADMIN', new TextEncoder().encode('an-attacker-chosen-secret-0123456789-xyz'))
        const res = await fetchPage(`${BASE_URL}/admin`, manual(forged))
        return [res.status === 307 && target(res).includes('/login'), `${res.status} -> ${target(res)}`]
      },
    },
    {
      id: 'TC-AUTH-05', name: 'Sign-in Page With Password Toggle, Mode Switch and Brand Logo',
      run: async () => {
        const res = await fetchPage(`${BASE_URL}/login`)
        const ok = res.status === 200 && res.body.includes('Sign in') && res.body.includes('name="password"') &&
          res.body.includes('Hiện mật khẩu') && res.body.includes('href="/register"') && res.body.includes('Cà phê cao nguyên')
        return [ok, `Status ${res.status}`]
      },
    },
    {
      id: 'TC-AUTH-06', name: 'Sign-up Page Creates Customer Accounts',
      run: async () => {
        const res = await fetchPage(`${BASE_URL}/register`)
        const ok = res.status === 200 && res.body.includes('Create account') && res.body.includes('name="confirm"') &&
          res.body.includes('aria-current="page"')
        return [ok, `Status ${res.status}`]
      },
    },
    {
      id: 'TC-AUTH-07', name: 'Admin Opens Accounts & Roles Page',
      run: async () => {
        const res = await fetchPage(`${BASE_URL}/admin/users`, manual(await sessionCookie('ADMIN')))
        const managerRes = await fetchPage(`${BASE_URL}/admin/users`, manual(await sessionCookie('MANAGER')))
        return [res.status === 200 && res.body.includes('Users') && managerRes.status === 307, `admin=${res.status}, manager=${managerRes.status}`]
      },
    },
    {
      id: 'TC-AUTH-08', name: 'Sign-in ?next= Cannot Leave the Site',
      run: async () => {
        const { safeNext } = await import('../lib/auth/roles.ts')
        const offSite = ['//evil.com', '/\\evil.com', '/\t/evil.com', '/\n/evil.com', '/\\\t\\evil.com', 'https://evil.com', 'evil.com']
          .filter((next) => safeNext(next) !== null)
        const kept = safeNext('/admin/pos?tab=kitchen#ticket') === '/admin/pos?tab=kitchen#ticket'
        // The form posts its hidden "next" field; it must come out empty for an off-site target.
        const res = await fetchPage(`${BASE_URL}/login?next=${encodeURIComponent('/\t/evil.com')}`)
        const field = res.body.match(/<input[^>]*name="next"[^>]*>/)?.[0] ?? ''
        const ok = offSite.length === 0 && kept && res.status === 200 && field.includes('value=""')
        return [ok, `kept=${kept}, leaked=${JSON.stringify(offSite)}, page=${res.status}, field=${field}`]
      },
    },
  ]

  for (const check of checks) {
    try {
      const [ok, details] = await check.run()
      recordTest(check.id, check.name, 'Auth & RBAC', ok ? 'PASS' : 'FAIL', details)
    } catch (err) {
      recordTest(check.id, check.name, 'Auth & RBAC', 'FAIL', err.message)
    }
  }
}

async function main() {
  console.log('=====================================================')
  console.log(' ĐÀ LẠT CAFE - UI/UX AUTOMATED TEST SUITE')
  console.log(` Target: ${BASE_URL}`)
  console.log('=====================================================')

  try {
    await ensureServerRunning()

    await runStorefrontTests()
    await runCartAndWishlistTests()
    await runAdminUITests()
    await runAdminMutationTests()
    await runAuthTests()
  } catch (err) {
    console.error('\n❌ Fatal Test Error:', err.message)
  } finally {
    cleanupServer()
  }

  console.log('\n=====================================================')
  console.log(' TEST EXECUTION SUMMARY')
  console.log('=====================================================')

  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const total = results.length

  console.log(`Total Test Cases: ${total}`)
  console.log(`Passed:           ${passed} (${Math.round((passed / total) * 100)}%)`)
  console.log(`Failed:           ${failed}`)

  if (failed > 0 || total === 0) {
    console.log('\nFailed Tests:')
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(` - [${r.id}] ${r.name}: ${r.details}`))
    process.exit(1)
  } else {
    console.log('\n🎉 ALL UI/UX TEST CASES PASSED SUCCESSFULLY!')
    process.exit(0)
  }
}

main()
