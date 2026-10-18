import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { SignJWT } from 'jose'

const port = 3117
const base = `http://localhost:${port}`
const secret = 'test-only-build-secret-no-production-credentials-0123456789'
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
  env: { ...process.env, DATABASE_URL: '', JAVA_BACKEND_URL: 'off', AUTH_JWT_SECRET: secret },
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
})
let logs = ''
server.stdout.on('data', data => { logs += data })
server.stderr.on('data', data => { logs += data })
let uploadedName

async function cookie(role, userId = 1) {
  const token = await new SignJWT({ role, email: 'table-test@example.test', name: 'Table test' })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(String(userId)).setIssuedAt().setExpirationTime('10m')
    .sign(new TextEncoder().encode(secret))
  return `dalatcafe_session=${token}`
}

try {
  let ready = false
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error(`Test server exited: ${logs}`)
    try { ready = (await fetch(`${base}/login`)).ok } catch {}
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.ok(ready, `Test server did not start: ${logs}`)
  const manager = await cookie('MANAGER')
  if (process.argv.includes('--browser')) {
    const { testTableBrowser } = await import('./test-table-browser.mjs')
    await testTableBrowser(base, manager)
  }
  const staff = await cookie('STAFF')
  const customer = await cookie('CUSTOMER', 2)
  for (const pathname of ['/admin', '/admin/tables', '/admin/staff', '/admin/schedule', '/checkout']) {
    const response = await fetch(base + pathname, { headers: { Cookie: manager } })
    assert.equal(response.status, 200, pathname)
    const html = await response.text()
    assert.doesNotMatch(html, /Bản demo|Có giao diện Demo|Demo QR|Demo Thẻ/, pathname)
    if (pathname === '/admin') {
      assert.ok(html.includes('Doanh thu 7 ngày gần nhất'))
      assert.ok(html.includes('Phiếu đặt bàn đang chờ'))
      assert.ok(!html.includes('775.000 đ'), 'Dashboard must not show the fixed sample revenue')
    }
  }
  const manifest = JSON.parse(await readFile('.next/server/server-reference-manifest.json', 'utf8'))
  async function action(name, args, pathname = '/admin/tables', auth = manager) {
    const id = Object.entries(manifest.node).find(([, entry]) => entry.exportedName === name)?.[0]
    assert.ok(id, `Missing server action ${name}`)
    const response = await fetch(base + pathname, { method: 'POST', headers: {
      Cookie: auth, 'Next-Action': id, 'Content-Type': 'text/plain;charset=UTF-8', Origin: base,
    }, body: JSON.stringify(args) })
    const text = await response.text()
    assert.equal(response.status, 200, text)
    const resultLine = text.split('\n').find(line => /^\d+:\{"ok":/.test(line))
    assert.ok(resultLine, text)
    return JSON.parse(resultLine.substring(resultLine.indexOf(':') + 1))
  }

  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4WQAAAAASUVORK5CYII=', 'base64')
  function imageForm(bytes, name = 'table.png') {
    const form = new FormData(); form.set('image', new Blob([bytes]), name); return form
  }
  assert.equal((await fetch(`${base}/api/table-images`, { method: 'POST', body: imageForm(image), headers: { Cookie: staff } })).status, 403)
  assert.equal((await fetch(`${base}/api/table-images`, { method: 'POST', body: imageForm('not an image'), headers: { Cookie: manager } })).status, 400)
  const upload = await fetch(`${base}/api/table-images`, { method: 'POST', body: imageForm(image), headers: { Cookie: manager } })
  assert.equal(upload.status, 201, await upload.clone().text())
  const { url } = await upload.json()
  uploadedName = new URL(base + url).searchParams.get('name')
  const read = await fetch(base + url, { headers: { Cookie: staff } })
  assert.equal(read.status, 200)
  assert.deepEqual(Buffer.from(await read.arrayBuffer()), image)
  assert.equal((await fetch(base + url, { headers: { Cookie: customer } })).status, 403)
  assert.equal((await fetch(`${base}/api/table-images?name=../secret`, { headers: { Cookie: staff } })).status, 404)

  const details = { name: 'HTTP CRUD test table', seats: 4, zone: 'HTTP test area', imageUrl: base + url }
  const denied = await action('saveTableDetails', [details], '/admin/tables', staff)
  assert.equal(denied.ok, false)
  const created = await action('saveTableDetails', [details])
  assert.equal(created.ok, true, JSON.stringify(created))
  assert.equal(created.data.imageUrl, base + url)
  const id = created.data.id
  assert.ok((await (await fetch(`${base}/admin/tables`, { headers: { Cookie: manager } })).text()).includes(details.name))
  const edited = await action('saveTableDetails', [{ ...details, name: 'HTTP edited table', seats: 6, imageUrl: null }, id])
  assert.equal(edited.ok, true, JSON.stringify(edited))
  assert.equal(edited.data.seats, 6)
  assert.equal(edited.data.imageUrl, null)
  assert.equal((await action('deleteTable', [id])).ok, true)
  assert.ok(!(await (await fetch(`${base}/admin/tables`, { headers: { Cookie: manager } })).text()).includes('HTTP edited table'))

  for (const address of ['12 Trần Phú, Hà Nội', '12 Trần Phú, Bảo Lộc', '12 An Sơn, Đức Trọng']) {
    const result = await action('placeOnlineOrder', [{ name: 'Test Buyer', phone: '0901234567', fulfilment: 'delivery', payment: 'cod', address }], '/checkout', customer)
    assert.equal(result.ok, false)
    assert.match(result.error, /chỉ giao hàng trong Đà Lạt/)
  }
  const cart = { lines: { nodes: [{ quantity: 1, merchandise: { id: 'gid://dalatcafe/ProductVariant/1', price: { amount: '45000', currencyCode: 'VND' }, product: { title: 'Test drink' } }, attributes: [] }] }, discountCodes: [] }
  const buyerCookie = `${customer}; dalatcafe-local-cart=${encodeURIComponent(JSON.stringify(cart))}`
  const buyer = { name: 'Test Buyer', phone: '0901234567', payment: 'cod', address: 'Số 07, An Sơn, Phường Xuân Hương - Đà Lạt, Lâm Đồng' }
  const delivery = await action('placeOnlineOrder', [{ ...buyer, fulfilment: 'delivery' }], '/checkout', buyerCookie)
  const pickup = await action('placeOnlineOrder', [{ ...buyer, fulfilment: 'pickup', address: '' }], '/checkout', buyerCookie)
  assert.equal(delivery.ok, true, JSON.stringify(delivery))
  assert.equal(pickup.ok, true, JSON.stringify(pickup))
  assert.equal(delivery.total - pickup.total, 10_000)
  assert.equal(delivery.paid, false)
  const voucherCart = { ...cart, discountCodes: [{ code: 'WELCOME10', applicable: true }] }
  const withVoucher = async id => `${await cookie('CUSTOMER', id)}; dalatcafe-local-cart=${encodeURIComponent(JSON.stringify(voucherCart))}`
  const request = { ...buyer, fulfilment: 'pickup' }
  const oldAccount = await action('placeOnlineOrder', [request], '/checkout', await withVoucher(2))
  assert.equal(oldAccount.ok, false, 'An existing online customer cannot use WELCOME10')
  assert.match(oldAccount.error, /đơn online đầu tiên/)
  const firstVoucher = await action('placeOnlineOrder', [request], '/checkout', await withVoucher(3))
  assert.equal(firstVoucher.ok, true, JSON.stringify(firstVoucher))
  assert.equal(firstVoucher.total, Math.round(pickup.total * 0.9 * 100) / 100, 'COD must actually receive the 10% discount')
  const reused = await action('placeOnlineOrder', [{ ...request, phone: '0909999999' }], '/checkout', await withVoucher(3))
  assert.equal(reused.ok, false, 'Changing phone numbers must not reset account eligibility')
  const oldCart = await fetch(`${base}/api/cart`, { headers: { Cookie: await withVoucher(3) } })
  assert.equal(oldCart.status, 200, await oldCart.clone().text())
  assert.equal((await oldCart.json()).discountCodes[0].applicable, false)
  const retryCookie = await withVoucher(4)
  const failed = await action('placeOnlineOrder', [{ ...request, payment: 'card' }], '/checkout', retryCookie)
  assert.equal(failed.ok, false, 'Java is offline: card checkout must fail without consuming eligibility')
  assert.equal((await action('placeOnlineOrder', [request], '/checkout', retryCookie)).ok, true)
  const racingCookie = await withVoucher(5)
  const racing = await Promise.all([action('placeOnlineOrder', [request], '/checkout', racingCookie), action('placeOnlineOrder', [request], '/checkout', racingCookie)])
  assert.equal(racing.filter(result => result.ok).length, 1, 'Only one concurrent request may use the offer')
  const voucherPage = await (await fetch(`${base}/account/vouchers`, { headers: { Cookie: await cookie('CUSTOMER', 3) } })).text()
  assert.ok(voucherPage.includes('Chưa có voucher khả dụng'))
  console.log('PASS: image upload/read/authorization, real Server Action table CRUD, persistence after page reload, server refusal of outside-Da-Lat addresses')
  console.log('PASS: WELCOME10 first order only, COD discount, reuse/phone bypass denied, failure retry and concurrent requests')
  const groupIds = []
  for (let index = 0; index < 3; index++) {
    const result = await action('saveTableDetails', [{ name: `Group HTTP ${index}`, seats: 4, zone: 'HTTP groups', imageUrl: null }])
    assert.equal(result.ok, true, JSON.stringify(result))
    groupIds.push(result.data.id)
  }
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  const booking = { customer: 'Group Buyer', contact: '0901234567', dateTime: `${tomorrow}T10:00:00+07:00`, guests: 6, tableId: groupIds[0], tableIds: groupIds.slice(0, 2), preOrders: [{ menuItemId: 1, qty: 1 }] }
  const booked = await action('bookCustomerTable', [booking], '/')
  assert.equal(booked.ok, true, JSON.stringify(booked))
  const conflict = await action('bookCustomerTable', [{ ...booking, guests: 2, tableId: groupIds[1], tableIds: [groupIds[1]] }], '/')
  assert.equal(conflict.ok, false, 'Conflicting secondary table must be rejected')
  assert.equal((await action('transferReservationToPos', [booked.id, 'local', 6], '/admin/reservations')).ok, true)
  const second = await action('bookCustomerTable', [{ ...booking, guests: 2, tableId: groupIds[2], tableIds: [groupIds[2]] }], '/')
  assert.equal(second.ok, true, JSON.stringify(second))
  assert.equal((await action('transferReservationToPos', [second.id, 'local', 2], '/admin/reservations')).ok, true)
  assert.equal((await action('settleTables', [{ tableIds: [groupIds[0], groupIds[2]], paymentMethod: 'cash', tenderedAmount: 1000000 }], '/admin/pos')).ok, false, 'Cannot pay a partial table group')
  assert.equal((await action('settleTables', [{ tableIds: groupIds, paymentMethod: 'cash', tenderedAmount: 1 }], '/admin/pos')).ok, false)
  const combined = await action('settleTables', [{ tableIds: groupIds, paymentMethod: 'cash', tenderedAmount: 1000000 }], '/admin/pos')
  assert.equal(combined.ok, true, JSON.stringify(combined))
  assert.equal(combined.receipt.orders.length, 2, 'Group reservation must not duplicate its preorder')
  assert.equal((await action('settleTables', [{ tableIds: groupIds, paymentMethod: 'cash', tenderedAmount: 1000000 }], '/admin/pos')).ok, false, 'Cannot collect payment twice')
  console.log('PASS: multi-table booking, secondary table conflicts, POS transfer, combined payment, insufficient cash and duplicate collection guards')
  if (process.argv.includes('--ui')) {
    const exitCode = await new Promise(resolve => {
      const suite = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/test-ui-ux.mjs'], {
        env: { ...process.env, DATABASE_URL: '', JAVA_BACKEND_URL: 'off', AUTH_JWT_SECRET: secret, TEST_BASE_URL: base },
        stdio: 'inherit', windowsHide: true,
      })
      suite.on('exit', resolve)
    })
    assert.equal(exitCode, 0, 'Existing UI/UX suite failed')
  }
} finally {
  server.kill()
  if (uploadedName && /^[a-f0-9-]{36}\.png$/.test(uploadedName)) await unlink(path.join('.data', 'table-images', uploadedName)).catch(() => {})
}
