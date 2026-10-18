import 'server-only'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

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

let groupColumnsReady: Promise<void> | undefined
let tableImagesReady: Promise<void> | undefined
export async function ensureTableImages(): Promise<void> {
  if (!pool) return
  tableImagesReady ??= pool.query('ALTER TABLE admin_tables ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS deleted_at timestamptz')
    .then(() => {}).catch(error => { tableImagesReady = undefined; throw error })
  await tableImagesReady
}

export async function ensureOrderTableGroups(): Promise<void> {
  if (!pool) return
  groupColumnsReady ??= pool.query("ALTER TABLE admin_orders ADD COLUMN IF NOT EXISTS table_ids jsonb NOT NULL DEFAULT '[]'::jsonb")
    .then(() => {}).catch(error => { groupColumnsReady = undefined; throw error })
  await groupColumnsReady
}

