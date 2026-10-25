import 'server-only'
import { pool } from '@/lib/db'

// Hai bảng phụ nhỏ nằm cạnh các bảng admin_*: admin_menu_links (id món frontend -> id món Java, vì
// hai thực đơn đánh số độc lập) và admin_sync_queue (mã các đơn ghi cục bộ mà backend Java chưa
// nhận). Chúng được tạo ở lần dùng đầu bằng IF NOT EXISTS và không bao giờ đụng tới các bảng
// admin_*. Không có database, hoặc không tạo được bảng, thì dùng bản sao trong bộ nhớ (cùng vòng
// đời với mock store).

type Memory = { menuLinks: Map<number, number>; syncQueue: Set<string> }

const globalForLinks = globalThis as unknown as { adminLinks?: Memory }
const memory: Memory = (globalForLinks.adminLinks ??= { menuLinks: new Map(), syncQueue: new Set() })

let ready: Promise<boolean> | null = null

function tablesReady(): Promise<boolean> {
  if (!pool) return Promise.resolve(false)
  ready ??= pool
    .query(`
      CREATE TABLE IF NOT EXISTS admin_menu_links (
        menu_item_id integer PRIMARY KEY,
        java_menu_id integer NOT NULL,
        linked_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS admin_sync_queue (
        order_code text PRIMARY KEY,
        queued_at timestamptz NOT NULL DEFAULT now()
      );
    `)
    .then(
      () => true,
      (error: unknown) => {
        console.warn('Could not create the link tables, keeping links in memory:', error)
        ready = null // thử lại ở lần gọi sau
        return false
      },
    )
  return ready
}

// Chạy nhánh SQL khi bảng tồn tại, nếu không (hoặc truy vấn lỗi) thì chạy nhánh bộ nhớ.
async function withStore<T>(sql: () => Promise<T>, fallback: () => T): Promise<T> {
  if (await tablesReady()) {
    try {
      return await sql()
    } catch (error) {
      console.warn('Link table query failed, using memory:', error)
    }
  }
  return fallback()
}

export function getMenuLinks(menuItemIds: number[]): Promise<Map<number, number>> {
  return withStore(
    async () => {
      const result = await pool!.query<{ menu_item_id: number; java_menu_id: number }>(
        'SELECT menu_item_id, java_menu_id FROM admin_menu_links WHERE menu_item_id = ANY($1::int[])',
        [menuItemIds],
      )
      return new Map(result.rows.map((row) => [row.menu_item_id, row.java_menu_id]))
    },
    () => new Map(menuItemIds.flatMap((id) => (memory.menuLinks.has(id) ? [[id, memory.menuLinks.get(id)!]] : []))),
  )
}

export function saveMenuLink(menuItemId: number, javaMenuId: number): Promise<void> {
  return withStore(
    async () => {
      await pool!.query(
        `INSERT INTO admin_menu_links (menu_item_id, java_menu_id) VALUES ($1, $2)
         ON CONFLICT (menu_item_id) DO UPDATE SET java_menu_id = EXCLUDED.java_menu_id, linked_at = now()`,
        [menuItemId, javaMenuId],
      )
    },
    () => {
      memory.menuLinks.set(menuItemId, javaMenuId)
    },
  )
}

export function deleteMenuLink(menuItemId: number): Promise<void> {
  return withStore(
    async () => {
      await pool!.query('DELETE FROM admin_menu_links WHERE menu_item_id = $1', [menuItemId])
    },
    () => {
      memory.menuLinks.delete(menuItemId)
    },
  )
}

export function enqueueSync(orderCode: string): Promise<void> {
  return withStore(
    async () => {
      await pool!.query('INSERT INTO admin_sync_queue (order_code) VALUES ($1) ON CONFLICT DO NOTHING', [orderCode])
    },
    () => {
      memory.syncQueue.add(orderCode)
    },
  )
}

export function dequeueSync(orderCodes: string[]): Promise<void> {
  if (orderCodes.length === 0) return Promise.resolve()
  return withStore(
    async () => {
      await pool!.query('DELETE FROM admin_sync_queue WHERE order_code = ANY($1::text[])', [orderCodes])
    },
    () => {
      for (const code of orderCodes) memory.syncQueue.delete(code)
    },
  )
}

export function listSyncQueue(): Promise<string[]> {
  return withStore(
    async () => {
      const result = await pool!.query<{ order_code: string }>('SELECT order_code FROM admin_sync_queue ORDER BY queued_at')
      return result.rows.map((row) => row.order_code)
    },
    () => [...memory.syncQueue],
  )
}
