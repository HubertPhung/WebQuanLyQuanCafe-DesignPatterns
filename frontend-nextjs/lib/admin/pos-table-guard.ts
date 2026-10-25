import 'server-only'
import { sql } from 'drizzle-orm'
import { db, isDbConfigured, pool } from '@/lib/db'
import { fetchTables, getJavaBackendUrl } from '@/lib/api-client'
import { getMockTables, getMockAllOrders } from '@/lib/db/mock-store'
import { tableHasOpenOrder } from './pos-table-availability'
import type { BranchId } from '@/lib/branches'

const unavailable = 'Bàn đang được sử dụng, đã có lịch đặt hoặc đang dọn. Vui lòng chọn bàn trống.'
const busy = new Set<number>()

/** Xếp hàng đơn mới của một bàn qua các bước thanh toán, lưu cục bộ và đồng bộ. */
export async function withPosTableLock<T>(tableId: number | null, work: () => Promise<T>): Promise<T> {
  if (tableId == null) return work()
  if (!pool) {
    if (busy.has(tableId)) throw new Error('Bàn đang được mở đơn ở quầy khác. Vui lòng tải lại.')
    busy.add(tableId)
    try { return await work() } finally { busy.delete(tableId) }
  }
  const client = await pool.connect()
  let locked = false
  let broken = false
  try {
    locked = (await client.query('SELECT pg_try_advisory_lock($1,$2) AS locked', [174328103, tableId])).rows[0].locked
    if (!locked) throw new Error('Bàn đang được mở đơn ở quầy khác. Vui lòng tải lại.')
    return await work()
  } finally {
    try {
      if (locked) await client.query('SELECT pg_advisory_unlock($1,$2)', [174328103, tableId])
    } catch { broken = true } finally { client.release(broken) }
  }
}

export async function assertPosTableAvailable(tableId: number | null, branch: BranchId): Promise<void> {
  if (tableId == null) return
  const remote = await fetchTables(branch)
  if (!remote.ok && (isDbConfigured || getJavaBackendUrl())) throw new Error('Chưa kiểm tra được tình trạng bàn. Vui lòng thử lại.')
  const table = (remote.ok ? remote.data : getMockTables()).find(table => table.id === tableId && table.branch === branch)
  if (!table || table.status !== 'available') throw new Error(unavailable)
  if (isDbConfigured && db) {
    const result = await db.execute(sql`select exists(select 1 from admin_orders where (table_id = ${tableId} or table_ids @> ${JSON.stringify([tableId])}::jsonb) and status <> 'cancelled' and (status <> 'completed' or payment_status = 'unpaid')) as busy`)
    if (result.rows[0]?.busy) throw new Error(unavailable)
  } else if (tableHasOpenOrder(tableId, getMockAllOrders())) throw new Error(unavailable)
}
