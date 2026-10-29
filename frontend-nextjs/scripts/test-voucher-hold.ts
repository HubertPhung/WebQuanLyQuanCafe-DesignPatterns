import assert from 'node:assert/strict'
import { withVoucherHold } from '../lib/orders/voucher-hold'

// Đơn COD đã giữ lượt voucher: ghi đơn thất bại (trả lỗi hoặc ném lỗi) thì lượt phải được trả.
async function main() {
  let releases = 0
  const release = async () => {
    releases++
    return { ok: true as const, data: { released: true } }
  }
  const failures: string[] = []
  const report = (message: string) => { failures.push(message) }

  const ok = await withVoucherHold(true, async () => ({ ok: true as const }), release, report)
  assert.equal(ok.ok, true)
  assert.equal(releases, 0, 'a recorded order keeps its use')

  const refused = await withVoucherHold(true, async () => ({ ok: false as const, error: 'Không ghi được đơn.' }), release, report)
  assert.equal(refused.ok, false)
  assert.equal(releases, 1, 'a refused order gives the use back')

  await assert.rejects(withVoucherHold(true, async () => { throw new Error('database down') }, release, report), /database down/)
  assert.equal(releases, 2, 'a thrown error gives the use back too')

  await withVoucherHold(false, async () => ({ ok: false as const, error: 'x' }), release, report)
  assert.equal(releases, 2, 'nothing is released when no voucher was held')

  const lost = await withVoucherHold(true, async () => ({ ok: false as const, error: 'x' }),
    async () => ({ ok: false as const, unreachable: true as const, error: 'Java down' }), report)
  assert.equal(lost.ok, false)
  assert.equal(failures.length, 1, 'a release that fails is reported, not dropped')
  assert.match(failures[0], /Java down/)

  console.log('voucher hold: all checks passed')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
