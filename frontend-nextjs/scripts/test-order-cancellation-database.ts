import assert from 'node:assert/strict'
import pg from 'pg'
import { ORDER_CANCELLATION_SCHEMA_SQL } from '../lib/db/order-status-schema'

// All writes target a session-local temporary table and are rolled back.
async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL statement_timeout='10s'")
    await client.query(`CREATE TEMP TABLE admin_orders (
      id integer PRIMARY KEY, status text NOT NULL, payment_status text NOT NULL,
      CONSTRAINT admin_orders_status_check CHECK (status IN ('pending','brewing','ready','completed'))
    ) ON COMMIT DROP`)
    await client.query("INSERT INTO admin_orders VALUES (1,'pending','unpaid'),(2,'ready','paid'),(3,'completed','paid')")
    await client.query('SAVEPOINT legacy')
    await assert.rejects(client.query("UPDATE admin_orders SET status='cancelled' WHERE id=1"), { code: '23514' })
    await client.query('ROLLBACK TO SAVEPOINT legacy')
    await client.query(ORDER_CANCELLATION_SCHEMA_SQL)
    await client.query(ORDER_CANCELLATION_SCHEMA_SQL)
    await client.query("UPDATE admin_orders SET status='cancelled',payment_status=CASE WHEN payment_status='paid' THEN 'refunded' ELSE payment_status END WHERE id IN (1,2)")
    assert.deepEqual((await client.query('SELECT * FROM admin_orders ORDER BY id')).rows, [
      { id: 1, status: 'cancelled', payment_status: 'unpaid' },
      { id: 2, status: 'cancelled', payment_status: 'refunded' },
      { id: 3, status: 'completed', payment_status: 'paid' },
    ])
    await client.query('SAVEPOINT invalid')
    await assert.rejects(client.query("UPDATE admin_orders SET status='invalid' WHERE id=1"), { code: '23514' })
    await client.query('ROLLBACK TO SAVEPOINT invalid')
    console.log('PASS: legacy constraint reproduced, upgrade is repeatable, unpaid/paid cancellation persists, invalid status rejected; real orders untouched')
  } finally {
    await client.query('ROLLBACK')
    client.release()
    await pool.end()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
