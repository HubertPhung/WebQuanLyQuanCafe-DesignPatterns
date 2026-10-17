import 'server-only'
import { pool } from '@/lib/db'

// Two small helper tables that sit next to the admin_* tables:
//   admin_menu_links  frontend menu item id -> Java menu item id (the two menus number independently)
//   admin_sync_queue  codes of orders recorded locally that the Java backend has not received yet
// They are created on first use with IF NOT EXISTS and never touch the admin_* tables. Without a
// database, or when they cannot be created, an in-memory copy (same lifetime as the mock store) is used.

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
        ready = null // try again on the next call
        return false
      },
    )
  return ready
}

// Runs the SQL path when the tables exist, otherwise (or when the query fails) the memory path.
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
