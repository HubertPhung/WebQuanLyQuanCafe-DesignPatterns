import assert from 'node:assert/strict'
import { RESERVATION_TIME_SLOTS } from '../lib/reservation-rules'
import { saveMockTable, createMockReservation, getMockReservations, expireMockNoShows, transferMockReservation, getMockOrdersByCode, settleMockTables } from '../lib/db/mock-store'

assert.equal(RESERVATION_TIME_SLOTS.length, 31)
assert.equal(RESERVATION_TIME_SLOTS[0], '07:00')
assert.equal(RESERVATION_TIME_SLOTS.at(-1), '22:00')
const ids = [0, 1, 2].map(index => saveMockTable({ name: `Reservation test ${index}`, seats: 4, zone: 'Test groups', imageUrl: null }).id)
const date = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
const input = { customer: 'Group test', contact: '0901234567', email: null, note: null, dateTime: new Date(`${date}T10:00:00+07:00`), guests: 6, tableId: ids[0], tableIds: ids.slice(0, 2), preOrders: [{ name: 'Coffee', qty: 1, price: 45000 }] }
assert.equal(createMockReservation({ ...input, tableIds: [ids[0]] }).ok, false)
assert.equal(createMockReservation({ ...input, tableIds: [ids[0], ids[0]] }).ok, false)
const first = createMockReservation(input)
assert.equal(first.ok, true)
assert.doesNotThrow(() => saveMockTable({ name: 'Updated group table', seats: 4, zone: 'Test groups', imageUrl: null }, ids[0]))
assert.throws(() => saveMockTable({ name: 'Updated group table', seats: 1, zone: 'Test groups', imageUrl: null }, ids[0]), /Số chỗ/)
assert.equal(createMockReservation({ ...input, guests: 2, tableId: ids[1], tableIds: [ids[1]] }).ok, false)
assert.equal(transferMockReservation(first.code!).ok, true)
const second = createMockReservation({ ...input, guests: 2, tableId: ids[2], tableIds: [ids[2]] })
assert.equal(second.ok, true)
const reservation = getMockReservations().find(value => value.code === second.code)!
const cutoff = reservation.dateTime.getTime() + 15 * 60000
expireMockNoShows(cutoff - 1)
assert.equal(reservation.status, 'Chờ xác nhận')
expireMockNoShows(cutoff)
assert.equal(reservation.status, 'Đã hủy')
assert.equal(transferMockReservation(second.code!).ok, false)
assert.equal(getMockReservations().find(value => value.code === first.code)!.status, 'Hoàn thành', 'Seated guests must not expire')
const orders = getMockOrdersByCode([first.code!])
assert.equal(orders.length, 1)
assert.equal(orders[0].items.length, 1)
assert.throws(() => settleMockTables([ids[0]], 'cash', 1000000))
assert.throws(() => settleMockTables(ids.slice(0, 2), 'cash', 1))
assert.throws(() => settleMockTables(ids.slice(0, 2), 'cash', 1000000, 1))
assert.equal(orders[0].paymentStatus, 'unpaid')
assert.equal(settleMockTables(ids.slice(0, 2), 'cash', 1000000).orders.length, 1)
assert.throws(() => settleMockTables(ids.slice(0, 2), 'cash', 1000000))
console.log('PASS: all opening slots, group capacity/conflicts, no-show 15-minute boundary, seated protection and atomic group payment guards')
