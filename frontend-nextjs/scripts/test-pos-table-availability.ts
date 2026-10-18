import assert from 'node:assert/strict'
import { markTablesInUse, tableHasOpenOrder } from '../lib/admin/pos-table-availability'
import { assertPosTableAvailable, withPosTableLock } from '../lib/admin/pos-table-guard'
import { pool } from '../lib/db'
import type { Order, FloorTable } from '../lib/db/schema'

async function main() {
  assert.equal(pool, null, 'Run without DATABASE_URL; no real orders are created')
  const tables = [1, 3, 4].map(id => ({ id, name: `Bàn ${id}`, status: 'available', branch: 'phan-dinh-phung', guestCount: 0, seats: 4, zone: 'Main', occupiedSince: null, updatedAt: new Date() })) as FloorTable[]
  const order = { tableId: 1, tableIds: [1, 3], status: 'pending', paymentStatus: 'unpaid' } as Order
  assert.equal(tableHasOpenOrder(3, [order]), true)
  assert.deepEqual(markTablesInUse(tables, [order]).map(table => table.status), ['occupied', 'occupied', 'available'])
  assert.equal(tableHasOpenOrder(3, [{ ...order, status: 'cancelled' }]), false)
  assert.equal(tableHasOpenOrder(3, [{ ...order, status: 'completed', paymentStatus: 'paid' }]), false)
  assert.equal(tableHasOpenOrder(3, [{ ...order, status: 'completed', paymentStatus: 'unpaid' }]), true)
  const beforeFetch = globalThis.fetch
  const beforeBackend = process.env.JAVA_BACKEND_URL
  process.env.JAVA_BACKEND_URL = 'http://pos-table.test'
  try {
    for (const status of ['occupied', 'reserved', 'cleaning']) {
      globalThis.fetch = async () => Response.json({ ok: true, data: [{ ...tables[1], status }] })
      await assert.rejects(assertPosTableAvailable(3, 'phan-dinh-phung'), /Vui lòng chọn bàn trống/)
    }
    globalThis.fetch = async () => Response.json({ ok: true, data: [tables[2]] })
    await assertPosTableAvailable(4, 'phan-dinh-phung')
    await assert.rejects(assertPosTableAvailable(3, 'phan-dinh-phung'))
    globalThis.fetch = async () => { throw new Error('Disconnected') }
    await assert.rejects(assertPosTableAvailable(3, 'phan-dinh-phung'), /Chưa kiểm tra/)
    await assertPosTableAvailable(null, 'phan-dinh-phung')
    await withPosTableLock(3, async () => {
      await assert.rejects(withPosTableLock(3, async () => {}), /quầy khác/)
      await withPosTableLock(4, async () => {})
    })
    await assert.rejects(withPosTableLock(3, async () => { throw new Error('Failed checkout') }))
    await withPosTableLock(3, async () => {})
    console.log('PASS: unpaid/grouped table occupancy, terminal states, stale selection guard, network failure and concurrent POS lock release')
  } finally {
    globalThis.fetch = beforeFetch
    if (beforeBackend === undefined) delete process.env.JAVA_BACKEND_URL
    else process.env.JAVA_BACKEND_URL = beforeBackend
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
