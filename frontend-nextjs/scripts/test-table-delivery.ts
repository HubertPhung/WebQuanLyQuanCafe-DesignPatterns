import assert from 'node:assert/strict'
import { isDaLatAddress, shippingFee } from '../lib/storefront/delivery'
import { saveMockTable, getMockTables, deleteMockTable, createMockOrderFromItems, getMockOrdersByCode, markMockOrderPaid, updateMockOrderStatus } from '../lib/db/mock-store'

for (const address of ['12 Trần Phú, Đà Lạt', '12 Trần Phú, TP. Đà Lạt, Lâm Đồng', '12 Tran Phu, Da Lat, Lam Dong, Viet Nam', 'Số 07, An Sơn, Phường Xuân Hương - Đà Lạt, Lâm Đồng', '07 An Sơn, ĐÀ LẠT', '07 An Son, dalat', '07 An Sơn, TP. ĐL, Lâm Đồng', '07 An Son DL', 'Đà Lạt, số 07 An Sơn', '07 An Sơn Đ.L.', '12 Đà Lạt, TP Hồ Chí Minh', '12 Trần Phú, Đà Lạt, Đồng Nai']) {
  assert.equal(isDaLatAddress(address), true, address)
}
for (const address of ['', '12 Trần Phú, Hà Nội', '12 Trần Phú, Bảo Lộc', '12 Trần Phú', 'Số 07, An Sơn, Đức Trọng']) {
  assert.equal(isDaLatAddress(address), false, address)
}
assert.equal(shippingFee('delivery'), 10_000)
assert.equal(shippingFee('pickup'), 0)

const before = getMockTables().length
const table = saveMockTable({ name: 'Test CRUD table', seats: 4, zone: 'Test zone', imageUrl: 'https://example.com/table.jpg' })
assert.equal(getMockTables().length, before + 1)
assert.equal(getMockTables().find(t => t.id === table.id)?.imageUrl, 'https://example.com/table.jpg')
assert.throws(() => saveMockTable({ name: table.name, seats: 4, zone: table.zone, imageUrl: null }))
const edited = saveMockTable({ name: 'Edited test table', seats: 6, zone: 'New zone', imageUrl: null }, table.id)
assert.equal(edited.seats, 6)
assert.equal(getMockTables().find(t => t.id === table.id)?.zone, 'New zone')
assert.equal(getMockTables().find(t => t.id === table.id)?.imageUrl, null)
assert.throws(() => deleteMockTable(2))
deleteMockTable(table.id)
assert.equal(getMockTables().length, before)
assert.equal(getMockTables().some(t => t.id === table.id), false)
console.log('PASS: Da Lat delivery policy, 10k shipping, table CRUD and image persistence in mock store')

const used = saveMockTable({ name: 'Previously used table', seats: 4, zone: 'Archive test', imageUrl: null })
assert.equal(createMockOrderFromItems({ orderCode: 'ARCHIVE-TEST-ORDER', customer: 'Test', tableId: used.id, items: [{ name: 'Coffee', qty: 1, price: 45000 }] }).ok, true)
assert.throws(() => deleteMockTable(used.id), /Bàn còn khách/)
const order = getMockOrdersByCode(['ARCHIVE-TEST-ORDER'])[0]
markMockOrderPaid(order.id)
updateMockOrderStatus(order.id, 'completed')
deleteMockTable(used.id)
assert.equal(getMockTables().some(table => table.id === used.id), false)
assert.equal(getMockOrdersByCode(['ARCHIVE-TEST-ORDER'])[0].tableId, used.id)
assert.throws(() => saveMockTable({ name: 'Cannot revive', seats: 4, zone: 'Archive test', imageUrl: null }, used.id))
const replacement = saveMockTable({ name: 'Previously used table', seats: 4, zone: 'Archive test', imageUrl: null })
assert.ok(replacement.id > used.id)
deleteMockTable(replacement.id)
console.log('PASS: table with completed paid order can be archived; order history and unique table ids are preserved')
