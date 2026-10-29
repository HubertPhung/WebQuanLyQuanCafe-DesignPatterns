import assert from 'node:assert/strict'
import { validateVoucher } from '../lib/api-client'

// Kiểm tra mã cho một tài khoản cần service key: thiếu key thì báo lỗi cấu hình, không âm thầm
// hỏi Java như khách vãng lai (khách đã đăng nhập sẽ thấy "Đăng nhập để dùng mã này").
async function main() {
  const fetchBefore = globalThis.fetch
  const keyBefore = process.env.AUTH_SERVICE_KEY
  const backendBefore = process.env.JAVA_BACKEND_URL
  const calls: { headers: Record<string, string>; body: Record<string, unknown> }[] = []
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    calls.push({ headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) })
    return Response.json({ ok: true, data: { code: 'SALE', valid: true, reason: 'OK', discountAmount: 0, shortfall: 0, description: '', firstOnlineOrderOnly: false } })
  }) as typeof fetch
  const errors: unknown[] = []
  const errorBefore = console.error
  console.error = (...args: unknown[]) => { errors.push(args) }
  try {
    process.env.JAVA_BACKEND_URL = 'http://voucher-api.test'

    delete process.env.AUTH_SERVICE_KEY
    const missing = await validateVoucher('SALE', 100_000, 7)
    assert.equal(missing.ok, false, 'a per-account check without the service key must not pass as a guest check')
    assert.equal(calls.length, 0, 'nothing is sent to Java without the key')
    assert.equal(errors.length, 1, 'the missing key is logged')

    const guest = await validateVoucher('SALE', 100_000)
    assert.equal(guest.ok, true, 'a guest check needs no key')
    assert.equal(calls.at(-1)!.body.userId, undefined)

    process.env.AUTH_SERVICE_KEY = 'test-service-key'
    const member = await validateVoucher('SALE', 100_000, 7)
    assert.equal(member.ok, true)
    assert.equal(calls.at(-1)!.headers['X-Service-Key'], 'test-service-key')
    assert.equal(calls.at(-1)!.body.userId, 7)
    console.log('voucher api: all checks passed')
  } finally {
    globalThis.fetch = fetchBefore
    console.error = errorBefore
    if (keyBefore === undefined) delete process.env.AUTH_SERVICE_KEY
    else process.env.AUTH_SERVICE_KEY = keyBefore
    if (backendBefore === undefined) delete process.env.JAVA_BACKEND_URL
    else process.env.JAVA_BACKEND_URL = backendBefore
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
