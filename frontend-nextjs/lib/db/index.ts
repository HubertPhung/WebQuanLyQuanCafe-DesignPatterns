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

