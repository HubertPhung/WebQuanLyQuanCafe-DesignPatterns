import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// Dùng Chrome đã cài và giao thức DevTools của nó; không thêm thư viện trình duyệt nào.
export async function testTableBrowser(base, auth) {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'cafe-table-browser-'))
  const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
  let socket
  try {
    const browserUrl = await new Promise((resolve, reject) => {
      let output = ''
      const timeout = setTimeout(() => reject(new Error('Chrome did not start')), 20000)
      chrome.on('error', reject)
      chrome.stderr.on('data', data => {
        output += data
        const match = output.match(/DevTools listening on (ws:\/\/\S+)/)
        if (match) { clearTimeout(timeout); resolve(match[1]) }
      })
    })
    socket = new WebSocket(browserUrl)
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
    let sequence = 0
    const callbacks = new Map()
    socket.onmessage = event => {
      const message = JSON.parse(event.data)
      if (!message.id) return
      const callback = callbacks.get(message.id)
      if (callback) { callbacks.delete(message.id); message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result) }
    }
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++sequence
      callbacks.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params, sessionId }))
    })
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    const call = (method, params) => send(method, params, sessionId)
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
      return result.result.value
    }
    async function wait(expression) {
      for (let index = 0; index < 100; index++) {
        if (await evaluate(expression)) return
        await new Promise(resolve => setTimeout(resolve, 150))
      }
      throw new Error(`Browser condition timed out: ${expression}; ${await evaluate('document.body.innerText')}`)
    }
    const click = text => evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(text)})?.click()`)
    const fill = (selector, value) => evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
    await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
    const [name, ...value] = auth.split('=')
    await call('Network.setCookie', { name, value: value.join('='), url: base })
    await call('Page.navigate', { url: `${base}/admin/tables` })
    await wait(`document.querySelector('button') && document.body.innerText.includes('Thêm bàn mới')`)
    // Để React hydrate xong rồi mới bấm vào các điều khiển thật.
    await new Promise(resolve => setTimeout(resolve, 1000))
    await click('+ Thêm bàn mới')
    await wait(`!!document.querySelector('#table-name')`)
    await fill('#table-name', 'Browser image table')
    await fill('input[list="table-zones"]', 'Browser zone')
    const drop = (type, bytes, name) => evaluate(`(() => {
      const file = new File([Uint8Array.from(atob(${JSON.stringify(bytes)}), char => char.charCodeAt(0))], ${JSON.stringify(name)}, { type: ${JSON.stringify(type)} });
      const data = new DataTransfer(); data.items.add(file);
      document.querySelector('[data-testid="table-image-dropzone"]').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
    })()`)
    await drop('text/plain', 'bm90LWFuLWltYWdl', 'bad.txt')
    await wait(`document.querySelector('[role="alert"]')?.textContent.includes('2 MB')`)
    await drop('image/jpeg', (await readFile('public/images/space/lounge.jpg')).toString('base64'), 'table.jpg')
    await wait(`document.querySelector('#table-image')?.value.includes('/api/table-images?name=')`)
    await click('Thêm bàn')
    await wait(`!document.querySelector('#table-name') && Array.from(document.querySelectorAll('[data-table-id]')).some(card => card.textContent.includes('Browser image table'))`)
    const card = `Array.from(document.querySelectorAll('[data-table-id]')).find(card => card.textContent.includes('Browser image table'))`
    const geometry = await evaluate(`(() => { const card = ${card}; const rect = card.getBoundingClientRect(); return { width: rect.width, height: rect.height, image: card.querySelector('img')?.src, imagePosition: getComputedStyle(card.querySelector('img')).position } })()`)
    assert.ok(geometry.width > geometry.height, JSON.stringify(geometry))
    assert.equal(geometry.imagePosition, 'absolute')
    assert.ok(geometry.image.includes('/api/table-images?name='))
    await evaluate(`(${card}).scrollIntoView({ block: 'center', behavior: 'instant' })`)
    await wait(`(${card}).querySelector('img').naturalWidth > 0`)
    await new Promise(resolve => setTimeout(resolve, 250))
    await mkdir('.data', { recursive: true })
    const screenshot = await call('Page.captureScreenshot', { format: 'png' })
    await writeFile('.data/table-card-browser.png', Buffer.from(screenshot.data, 'base64'))
    await evaluate(`Array.from((${card}).querySelectorAll('button')).find(button => button.textContent.trim() === 'Sửa').click()`)
    await wait(`!!document.querySelector('#table-name')`)
    await fill('#table-name', 'Browser edited table')
    await click('Lưu thay đổi')
    await wait(`!document.querySelector('#table-name') && document.body.innerText.includes('Browser edited table')`)
    await call('Page.reload', {})
    await wait(`Array.from(document.querySelectorAll('[data-table-id]')).some(card => card.textContent.includes('Browser edited table') && card.querySelector('img'))`)
    await new Promise(resolve => setTimeout(resolve, 1000))
    await evaluate(`Array.from(Array.from(document.querySelectorAll('[data-table-id]')).find(card => card.textContent.includes('Browser edited table')).querySelectorAll('button')).find(button => button.textContent.trim() === 'Xóa').click()`)
    await wait(`Array.from(document.querySelectorAll('button')).some(button => button.textContent.trim() === 'Xóa bàn')`)
    await click('Xóa bàn')
    await wait(`!document.body.innerText.includes('Browser edited table')`)
    await call('Page.reload', {})
    await wait(`document.body.innerText.includes('Thêm bàn mới')`)
    assert.equal(await evaluate(`document.body.innerText.includes('Browser edited table')`), false)
    console.log('PASS: real Chrome add/edit/delete clicks, drag-and-drop validation/upload, background image, landscape cards and reload persistence')
  } finally {
    socket?.close()
    chrome.kill()
    await new Promise(resolve => { if (chrome.exitCode !== null) resolve(); else { chrome.once('exit', resolve); setTimeout(resolve, 3000) } })
    if (path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith('cafe-table-browser-')) await rm(profile, { recursive: true, force: true }).catch(() => {})
  }
}
