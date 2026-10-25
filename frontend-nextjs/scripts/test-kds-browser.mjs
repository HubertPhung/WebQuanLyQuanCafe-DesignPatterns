import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import os from 'node:os'
import path from 'node:path'
import { SignJWT } from 'jose'

// Smoke test chỉ đọc: mở hộp thoại hủy, rồi giữ lại đơn thật.
if (existsSync('.env.local')) loadEnvFile('.env.local')
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const token = await new SignJWT({ role: 'ADMIN', name: 'KDS UI test', email: 'admin@test.local' })
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject('1').setIssuedAt().setExpirationTime('10m')
  .sign(new TextEncoder().encode(process.env.AUTH_JWT_SECRET ?? 'dalatcafe-dev-only-secret-change-me-0123456789'))
const profile = await mkdtemp(path.join(os.tmpdir(), 'cafe-kds-browser-'))
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
let socket
try {
  const url = await new Promise((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error('Chrome startup timed out')), 20000)
    chrome.on('error', reject)
    chrome.stderr.on('data', data => {
      output += data
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/)
      if (match) { clearTimeout(timeout); resolve(match[1]) }
    })
  })
  socket = new WebSocket(url)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let sequence = 0
  const callbacks = new Map()
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    const callback = callbacks.get(message.id)
    if (callback) {
      callbacks.delete(message.id)
      message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result)
    }
  }
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence
    const timeout = setTimeout(() => { callbacks.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 30000)
    callbacks.set(id, { resolve: value => { clearTimeout(timeout); resolve(value) }, reject: error => { clearTimeout(timeout); reject(error) } })
    socket.send(JSON.stringify({ id, method, params, sessionId }))
  })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const call = (method, params) => send(method, params, sessionId)
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  const wait = async expression => {
    for (let index = 0; index < 120; index++) {
      if (await evaluate(expression)) return
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    throw new Error(`Browser condition timed out: ${expression}`)
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false })
  await call('Network.setCookie', { name: 'dalatcafe_session', value: token, url: base })
  await call('Page.navigate', { url: `${base}/admin/pos?tab=kitchen` })
  await wait(`document.body.innerText.includes('Chờ pha chế') && document.querySelectorAll('[data-slot="card"]').length > 0`)
  await new Promise(resolve => setTimeout(resolve, 1500))
  const text = await evaluate('document.body.innerText')
  assert.doesNotMatch(text, /\b(Queued|Brewing|Ready|Served|Dashboard|ADMIN CONSOLE|offline)\b/i)
  const tickets = await evaluate(`Array.from(document.querySelectorAll('[data-slot="card"]')).map(card => card.innerText)`)
  const target = process.env.KDS_EXPECT_ORDER
  if (target) {
    const ticket = tickets.find(ticket => ticket.includes(target))
    assert.ok(ticket, `Ticket ${target} must be visible`)
    const expectedTables = (process.env.KDS_EXPECT_TABLES ?? '').split(',').filter(Boolean)
    for (const table of expectedTables) assert.match(ticket, new RegExp('Bàn\\s*0?' + Number(table) + '(?!\\d)'))
  }
  const before = await evaluate(`Array.from(document.querySelectorAll('button')).filter(button => button.textContent.trim() === 'Hủy đơn').length`)
  assert.ok(before > 0, 'Active tickets have cancellation buttons')
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Hủy đơn').click()`)
  await wait(`!!document.querySelector('[role="dialog"]') && document.body.innerText.includes('Xác nhận hủy')`)
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Giữ đơn').click()`)
  await wait(`!document.querySelector('[role="dialog"]')`)
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).filter(button => button.textContent.trim() === 'Hủy đơn').length`), before)
  await mkdir('test-artifacts', { recursive: true })
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await writeFile('test-artifacts/kds-vietnamese.png', Buffer.from(shot.data, 'base64'))
  console.log(`PASS: ${before} kitchen tickets, Vietnamese labels, grouped table details and cancellation dialog (no orders changed)`)
} finally {
  socket?.close()
  chrome.kill()
  await new Promise(resolve => { if (chrome.exitCode !== null) resolve(); else { chrome.once('exit', resolve); setTimeout(resolve, 3000) } })
  const resolved = path.resolve(profile)
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('cafe-kds-browser-')) await rm(resolved, { recursive: true, force: true }).catch(() => {})
}
