import 'server-only'
import { pool } from '@/lib/db'
import { Pool, type PoolClient } from 'pg'
import { hasOnlineOrderForUser } from './online-contacts'

const LOCK_NAMESPACE = 174328101
const state = globalThis as typeof globalThis & {
  firstOnlineOrders?: Set<number>
  onlineOrderLocks?: Set<number>
  onlineOrderLockPool?: Pool
}
const placed = state.firstOnlineOrders ??= new Set<number>()
const busy = state.onlineOrderLocks ??= new Set<number>()
// Bên giữ khóa không được dùng cạn pool kết nối mà lượt checkout của nó cần cho transaction.
const lockPool = pool ? (state.onlineOrderLockPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })) : null
let schemaReady: Promise<unknown> | undefined

async function ensureSchema() {
  if (!pool) return
  schemaReady ??= pool.query(`
    CREATE TABLE IF NOT EXISTS admin_first_online_orders (
      user_id integer PRIMARY KEY,
      claimed_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE admin_first_online_orders ENABLE ROW LEVEL SECURITY;
  `).catch(error => { schemaReady = undefined; throw error })
  await schemaReady
}

/** Không có lối dự phòng dễ dãi khi database đã cấu hình mà không kiểm tra được lịch sử đơn. */
export async function isFirstOnlineOrderAvailable(userId: number): Promise<boolean> {
  if (busy.has(userId) || placed.has(userId)) return false
  await ensureSchema()
  if (pool) {
    const result = await pool.query('SELECT 1 FROM admin_first_online_orders WHERE user_id = $1', [userId])
    if (result.rowCount) return false
  }
  return !(await hasOnlineOrderForUser(userId))
}

/**
 * Tuần tự hóa tài khoản này giữa các tiến trình server; giữ quyền ưu đãi trước khi thu bất kỳ khoản
 * tiền nào.
 */
export async function withFirstOnlineOrder<T>(userId: number, work: (context: { isFirstOrder: boolean; markPlaced: () => void }) => Promise<T>): Promise<T> {
  if (busy.has(userId)) throw new Error('Tài khoản đang có đơn được xử lý. Vui lòng đợi rồi thử lại.')
  busy.add(userId)
  let client: PoolClient | undefined
  let locked = false
  let reserved = false
  let orderPlaced = false
  let brokenConnection = false
  try {
    await ensureSchema()
    if (lockPool) {
      client = await lockPool.connect()
      const lock = await client.query('SELECT pg_try_advisory_lock($1, $2) AS locked', [LOCK_NAMESPACE, userId])
      locked = lock.rows[0].locked
      if (!locked) throw new Error('Tài khoản đang có đơn được xử lý. Vui lòng đợi rồi thử lại.')
    }
    let isFirstOrder = !placed.has(userId) && !(await hasOnlineOrderForUser(userId))
    if (client && isFirstOrder) {
      const result = await client.query('INSERT INTO admin_first_online_orders (user_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING user_id', [userId])
      reserved = result.rowCount === 1
      isFirstOrder = reserved
    }
    return await work({ isFirstOrder, markPlaced: () => { orderPlaced = true; placed.add(userId) } })
  } finally {
    try {
      // Lượt checkout bị từ chối/không khả dụng không tạo đơn, nên ưu đãi đơn đầu tiên vẫn còn.
      if (client && reserved && !orderPlaced) await client.query('DELETE FROM admin_first_online_orders WHERE user_id = $1', [userId])
    } finally {
      try {
        if (client && locked) await client.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_NAMESPACE, userId])
      } catch {
        brokenConnection = true
      } finally {
        client?.release(brokenConnection)
        busy.delete(userId)
      }
    }
  }
}
