import assert from 'node:assert/strict'
import { isFirstOnlineOrderAvailable, withFirstOnlineOrder } from '../lib/orders/first-online-order'
import { saveOrderContact } from '../lib/orders/online-contacts'
import { pool } from '../lib/db'
import { spawn } from 'node:child_process'

async function worker(mode: string): Promise<number | null> {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--conditions=react-server', '--import', 'tsx', 'scripts/test-first-online-order.ts', mode], { stdio: 'inherit', windowsHide: true })
    child.on('error', reject)
    child.on('exit', resolve)
  })
}

async function run() {
  assert.equal(await isFirstOnlineOrderAvailable(90001), true)
  await withFirstOnlineOrder(90001, async context => { assert.equal(context.isFirstOrder, true); context.markPlaced() })
  assert.equal(await isFirstOnlineOrderAvailable(90001), false)
  await withFirstOnlineOrder(90001, async context => { assert.equal(context.isFirstOrder, false) })

  await assert.rejects(withFirstOnlineOrder(90002, async () => { throw new Error('Payment refused') }))
  assert.equal(await isFirstOnlineOrderAvailable(90002), true)

  let finish!: () => void
  const gate = new Promise<void>(resolve => { finish = resolve })
  const first = withFirstOnlineOrder(90003, async () => { await gate })
  await assert.rejects(withFirstOnlineOrder(90003, async () => {}), /đang có đơn/)
  finish()
  await first
  assert.equal(await isFirstOnlineOrderAvailable(90003), true)

  await saveOrderContact({ orderCode: 'HISTORIC-ONLINE', userId: 90004, phone: '0901234567', email: null, address: null, fulfilment: 'pickup', note: null })
  assert.equal(await isFirstOnlineOrderAvailable(90004), false)
  await withFirstOnlineOrder(90004, async context => { assert.equal(context.isFirstOrder, false) })
  if (pool) {
    assert.equal(await worker('--persisted-worker'), 0)
    const results = await Promise.all([worker('--race-worker'), worker('--race-worker')])
    assert.equal(results.filter(code => code === 0).length, 1)
    assert.equal(results.filter(code => code === 2).length, 1)
    console.log('PASS: PostgreSQL persistence across processes and concurrent voucher claims from separate processes')
  }
  console.log('PASS: first-order eligibility, existing history, failed checkout retry and concurrent request protection')
}

async function main() {
  try {
    if (process.argv.includes('--persisted-worker')) {
      assert.equal(await isFirstOnlineOrderAvailable(90001), false)
    } else if (process.argv.includes('--race-worker')) {
      try {
        await withFirstOnlineOrder(90005, async ({ isFirstOrder, markPlaced }) => {
          if (!isFirstOrder) throw new Error('Not first')
          await new Promise(resolve => setTimeout(resolve, 300))
          markPlaced()
        })
      } catch (error) {
        if (!(error instanceof Error) || !/Not first|đang có đơn/.test(error.message)) throw error
        process.exitCode = 2
      }
    } else await run()
  } finally {
    const globals = globalThis as typeof globalThis & { onlineOrderLockPool?: { end(): Promise<void> } }
    await globals.onlineOrderLockPool?.end()
    await pool?.end()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
