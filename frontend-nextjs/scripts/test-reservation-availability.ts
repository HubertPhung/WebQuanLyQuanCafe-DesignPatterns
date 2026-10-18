import assert from 'node:assert/strict'
import { getReservationTableOptions as getCustomerReservationTables } from '../lib/reservations/availability'
import { createMockReservation, saveMockTable, updateMockReservationStatus } from '../lib/db/mock-store'
import { RESERVATION_SLOT_MS } from '../lib/reservation-rules'
import { DEFAULT_BRANCH_ID } from '../lib/branches'

async function main() {
  const fetchBefore = globalThis.fetch
  const backendBefore = process.env.JAVA_BACKEND_URL
  const slot = new Date(Date.now() + 3 * 86400000)
  slot.setUTCHours(3, 0, 0, 0)
  const ids = [0, 1, 2].map(index => saveMockTable({ name: `Availability ${index}`, seats: 4, zone: 'Availability test', imageUrl: null }).id)
  try {
    process.env.JAVA_BACKEND_URL = 'off'
    const booking = createMockReservation({ customer: 'Availability guest', contact: '0901234567', email: null, note: null, dateTime: slot, guests: 6, tableId: ids[0], tableIds: ids.slice(0, 2) })
    assert.equal(booking.ok, true)
    const available = async (time: Date) => {
      const result = await getCustomerReservationTables(time.toISOString(), DEFAULT_BRANCH_ID)
      assert.equal(result.ok, true)
      return ids.map(id => result.tables.find(table => table.id === id)!.available)
    }
    assert.deepEqual(await available(slot), [false, false, true])
    assert.deepEqual(await available(new Date(slot.getTime() + RESERVATION_SLOT_MS - 1)), [false, false, true])
    assert.deepEqual(await available(new Date(slot.getTime() + RESERVATION_SLOT_MS)), [true, true, true])
    assert.deepEqual(await available(new Date(slot.getTime() - RESERVATION_SLOT_MS)), [true, true, true])
    assert.equal(updateMockReservationStatus(booking.code!, 'Đã hủy').ok, true)
    assert.deepEqual(await available(slot), [true, true, true])

    process.env.JAVA_BACKEND_URL = 'http://reservation-availability.test'
    globalThis.fetch = async input => {
      const url = new URL(String(input))
      assert.equal(url.pathname, '/api/tables/catalog')
      assert.equal(url.searchParams.get('dateTime'), slot.toISOString())
      assert.equal(url.searchParams.get('branch'), DEFAULT_BRANCH_ID)
      return Response.json({ ok: true, data: [{ id: ids[0], name: 'Bàn 1', seats: 4, zone: 'Main', branch: DEFAULT_BRANCH_ID, available: false }] })
    }
    const remote = await getCustomerReservationTables(slot.toISOString(), DEFAULT_BRANCH_ID)
    assert.equal(remote.ok, true)
    assert.equal(remote.tables[0].available, false)
    globalThis.fetch = async () => { throw new Error('Network unavailable') }
    const unavailable = await getCustomerReservationTables(slot.toISOString(), DEFAULT_BRANCH_ID)
    assert.equal(unavailable.ok, false, 'A disconnected backend must never advertise independent demo tables')
    assert.deepEqual(unavailable.tables, [])
    globalThis.fetch = async () => Response.json({ ok: true, data: [{ id: ids[0], name: 'Old server without schedule' }] })
    assert.equal((await getCustomerReservationTables(slot.toISOString(), DEFAULT_BRANCH_ID)).ok, false)
    assert.equal((await getCustomerReservationTables('invalid', DEFAULT_BRANCH_ID)).ok, false)
    console.log('PASS: grouped table availability, overlap boundaries, cancelled slots, scoped remote lookup and unavailable schedule protection')
  } finally {
    globalThis.fetch = fetchBefore
    if (backendBefore === undefined) delete process.env.JAVA_BACKEND_URL
    else process.env.JAVA_BACKEND_URL = backendBefore
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
