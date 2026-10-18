import 'server-only'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { ORDER_CANCELLATION_SCHEMA_SQL } from './order-status-schema'
import { MENU_IMAGE_SCHEMA_SQL } from './menu-image-schema'

export const isDbConfigured = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '')

const globalForDb = globalThis as unknown as { adminPool?: Pool; drizzleDb?: ReturnType<typeof drizzle> }

export const pool = isDbConfigured
  ? (globalForDb.adminPool ?? new Pool({ connectionString: process.env.DATABASE_URL }))
  : null

if (pool && process.env.NODE_ENV !== 'production') {
  globalForDb.adminPool = pool
}

export const db = (pool ? (globalForDb.drizzleDb ?? drizzle(pool, { schema })) : null) as ReturnType<typeof drizzle>
if (db && process.env.NODE_ENV !== 'production') {
  globalForDb.drizzleDb = db
}

// Columns added after the first release; rows from before branches belong to the first branch.
let groupColumnsReady: Promise<void> | undefined
let tableImagesReady: Promise<void> | undefined
let orderCancellationReady: Promise<void> | undefined
let menuImagesReady: Promise<void> | undefined
export async function ensureMenuImageStorage(): Promise<void> {
  if (!pool) return
  menuImagesReady ??= pool.query(MENU_IMAGE_SCHEMA_SQL)
    .then(() => {}).catch(error => { menuImagesReady = undefined; throw error })
  await menuImagesReady
}

export async function ensureOrderCancellation(): Promise<void> {
  if (!pool) return
  orderCancellationReady ??= pool.query(ORDER_CANCELLATION_SCHEMA_SQL)
    .then(() => {}).catch(error => { orderCancellationReady = undefined; throw error })
  await orderCancellationReady
}

export async function ensureTableImages(): Promise<void> {
  if (!pool) return
  tableImagesReady ??= pool.query("ALTER TABLE admin_tables ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS branch text NOT NULL DEFAULT 'phan-dinh-phung'")
    .then(() => {}).catch(error => { tableImagesReady = undefined; throw error })
  await tableImagesReady
}

export async function ensureOrderTableGroups(): Promise<void> {
  if (!pool) return
  groupColumnsReady ??= pool.query("ALTER TABLE admin_orders ADD COLUMN IF NOT EXISTS table_ids jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN IF NOT EXISTS branch text NOT NULL DEFAULT 'phan-dinh-phung'")
    .then(() => {}).catch(error => { groupColumnsReady = undefined; throw error })
  await groupColumnsReady
}

