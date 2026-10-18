import assert from 'node:assert/strict'
import { getAccountReservations } from '../lib/account/reservations'
import { createMockReservation, saveMockTable, updateMockReservationStatus } from '../lib/db/mock-store'
import { pool } from '../lib/db'
import type { Session } from '../lib/auth/session'

assert.equal(pool, null, 'Run this regression test without DATABASE_URL')
const session: Session = { userId: 90001, email: 'owner@example.com', name: 'Owner', role: 'CUSTOMER', expiresAt: 9999999999, token: 'owner-token' }
const date = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })

function book(userId: number | null, email: string | null, time: string) {
  const tableId = saveMockTable({ name: `Account booking ${time}`, seats: 4, zone: 'History test', imageUrl: null }).id
  const result = createMockReservation({ userId, email, customer: 'Guest', contact: '0901234567', note: 'Near window', guests: 2, tableId, dateTime: new Date(`${date}T${time}:00+07:00`), preOrders: [{ name: 'Coffee', qty: 2, price: 45000 }] })
  assert.equal(result.ok, true)
  return result.code!
}

async function main() {
  const originalFetch = globalThis.fetch
  const originalBackend = process.env.JAVA_BACKEND_URL
  try {
    process.env.JAVA_BACKEND_URL = 'off'
    const owned = book(session.userId, 'different@example.com', '10:00')
    const legacy = book(null, ' OWNER@EXAMPLE.COM ', '12:00')
    book(90002, session.email, '14:00')
    book(null, null, '16:00')
    assert.equal(updateMockReservationStatus(owned, 'Đã hủy').ok, true)
    const local = await getAccountReservations(session)
    assert.deepEqual(local.reservations.map(reservation => reservation.code), [legacy, owned])
    assert.equal(local.reservations[1].status, 'Đã hủy')
    assert.equal(local.reservations[0].preOrders[0].qty, 2)
    assert.equal(local.reservationsUnavailable, false)

    process.env.JAVA_BACKEND_URL = 'http://reservation-history.test'
    globalThis.fetch = async (input, options) => {
      assert.equal(input, 'http://reservation-history.test/api/reservations/mine')
      assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer owner-token')
      return Response.json({ ok: true, data: [{ id: 'RES-REMOTE', dateTime: `${date}T18:00:00+07:00`, table: 'Bàn 9, Bàn 10', branch: 'bui-thi-xuan', guests: 6, status: 'Khách đã nhận bàn', note: null, preOrders: [] }] })
    }
    const merged = await getAccountReservations(session)
    assert.equal(merged.reservations.length, 3)
    assert.equal(merged.reservations[0].code, 'RES-REMOTE')
    assert.equal(merged.reservations[0].status, 'Đã nhận bàn')
    assert.equal(merged.reservations[0].branch, 'bui-thi-xuan')
    assert.equal(merged.reservationsUnavailable, false)

    globalThis.fetch = async () => { throw new Error('Backend unavailable') }
    const unavailable = await getAccountReservations(session)
    assert.equal(unavailable.reservationsUnavailable, true)
    assert.equal(unavailable.reservations.length, 2)
    console.log('PASS: account ownership, legacy email, cancellation history, scoped API, branch details, sorting and unavailable history')
  } finally {
    globalThis.fetch = originalFetch
    if (originalBackend === undefined) delete process.env.JAVA_BACKEND_URL
    else process.env.JAVA_BACKEND_URL = originalBackend
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
