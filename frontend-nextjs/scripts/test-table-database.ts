import assert from 'node:assert/strict'
import { pool } from '../lib/db'
import { saveDatabaseTable, deleteDatabaseTable } from '../lib/admin/table-repository'

async function run() {
  const url = new URL(process.env.DATABASE_URL!)
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Run only against an isolated local test database')
  assert.ok(pool)
  await pool.query(`CREATE TABLE admin_tables (id integer PRIMARY KEY, name text NOT NULL, seats integer NOT NULL DEFAULT 2, zone text NOT NULL DEFAULT 'Main', status text NOT NULL DEFAULT 'available', guest_count integer NOT NULL DEFAULT 0, occupied_since timestamptz, updated_at timestamptz NOT NULL DEFAULT now()); CREATE TABLE admin_orders (id serial PRIMARY KEY, table_id integer, status text NOT NULL DEFAULT 'pending', payment_status text NOT NULL DEFAULT 'unpaid')`)
  const details = { name: 'Database table', seats: 4, zone: 'Test zone', imageUrl: 'http://localhost/api/table-images?name=test.png' }
  const created = await saveDatabaseTable(details)
  assert.equal(created.imageUrl, details.imageUrl)
  const edited = await saveDatabaseTable({ ...details, name: 'Updated table', seats: 6 }, created.id)
  assert.equal(edited.seats, 6)
  assert.equal((await pool.query('SELECT name,image_url FROM admin_tables WHERE id=$1', [created.id])).rows[0].image_url, details.imageUrl)
  const concurrent = await Promise.all([saveDatabaseTable({ ...details, name: 'Parallel A' }), saveDatabaseTable({ ...details, name: 'Parallel B' })])
  assert.notEqual(concurrent[0].id, concurrent[1].id)
  const duplicates = await Promise.allSettled([saveDatabaseTable({ ...details, name: 'Same' }), saveDatabaseTable({ ...details, name: 'SAME' })])
  assert.equal(duplicates.filter(result => result.status === 'fulfilled').length, 1)
  await pool.query("UPDATE admin_tables SET status='occupied',guest_count=4 WHERE id=$1", [created.id])
  await assert.rejects(deleteDatabaseTable(created.id), /Bàn còn khách/)
  await assert.rejects(saveDatabaseTable({ ...details, seats: 2 }, created.id), /Số chỗ/)
  await pool.query("UPDATE admin_tables SET status='available',guest_count=0 WHERE id=$1", [created.id])
  await deleteDatabaseTable(created.id)
  assert.ok((await pool.query('SELECT deleted_at FROM admin_tables WHERE id=$1', [created.id])).rows[0].deleted_at)
  await assert.rejects(saveDatabaseTable(details, created.id), /Không tìm thấy/)
  await pool.query('INSERT INTO admin_orders(table_id,table_ids) VALUES ($1,$2::jsonb)', [concurrent[0].id, JSON.stringify(concurrent.map(table => table.id))])
  await assert.rejects(deleteDatabaseTable(concurrent[1].id), /Bàn còn khách/, 'Open orders on secondary tables must prevent deletion')
  await pool.query("UPDATE admin_orders SET status='completed',payment_status='paid'")
  await deleteDatabaseTable(concurrent[1].id)
  assert.equal((await pool.query('SELECT id FROM admin_orders')).rowCount, 1, 'History is preserved')
  const next = await saveDatabaseTable({ ...details, name: 'Replacement table' })
  assert.ok(next.id > concurrent[1].id, 'Never recycle archived table ids')
  console.log('PASS: PostgreSQL CRUD/images, concurrency, soft deletion preserves history and guards open orders; archived ids cannot be reused')
}
run().finally(() => pool?.end()).catch(error => { console.error(error); process.exitCode = 1 })
