import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isLocalImageSource, localImageSrc } from '../lib/assets'

const root = fileURLToPath(new URL('../../', import.meta.url))
const manifest = JSON.parse(readFileSync(path.join(root, 'docs/assets/sources.json'), 'utf8'))

for (const asset of manifest.assets) {
  const bytes = readFileSync(path.join(root, asset.file))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.file)
  if (asset.kind === 'image') {
    assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff', asset.file)
    assert.equal(localImageSrc(asset.source), `/${asset.file.split('/public/')[1]}`)
  }
}

assert.equal(localImageSrc('/images/latte.png'), '/images/latte.png')
assert.equal(localImageSrc('/api/table-images?name=local.jpg'), '/api/table-images?name=local.jpg')
const uploaded = 'data:image/png;base64,aGVsbG8='
assert.equal(localImageSrc(uploaded), uploaded)
for (const external of ['https://example.com/image.jpg', '//example.com/image.jpg', '/\\example.com/image.jpg']) {
  assert.equal(isLocalImageSource(external), false, external)
  assert.equal(localImageSrc(external), '/placeholder.svg', external)
}
assert.equal(localImageSrc(null, ''), '')
assert.equal(localImageSrc('invalid source'), '/placeholder.svg')
for (const replacement of manifest.replacements) {
  assert.equal(localImageSrc(replacement.source), replacement.local)
  assert.ok(existsSync(path.join(root, 'frontend-nextjs/public', replacement.local)))
}
for (const file of ['frontend-nextjs/app/layout.tsx', 'frontend-nextjs/app/globals.css']) {
  const source = readFileSync(path.join(root, file), 'utf8')
  assert.doesNotMatch(source, /next\/font\/google|fonts\.googleapis\.com|fonts\.gstatic\.com/, file)
}
const graphDirectory = path.join(root, 'graphify-out')
const graphPages = existsSync(graphDirectory) ? readdirSync(graphDirectory, { recursive: true }) : []
for (const name of graphPages.filter((entry): entry is string => typeof entry === 'string' && entry.endsWith('.html'))) {
  const file = path.join(graphDirectory, name)
  const html = readFileSync(file, 'utf8')
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)]
  assert.ok(scripts.length > 0, file)
  for (const [tag, src] of scripts) {
    assert.doesNotMatch(src, /^(?:https?:)?\/\//, file)
    assert.ok(existsSync(path.resolve(path.dirname(file), src)), src)
    assert.doesNotMatch(tag, /crossorigin|integrity/, 'Graphify must also open through file://')
  }
}
console.log(`PASS: ${manifest.assets.length} bundled files, legacy image URLs, local uploads and font imports`)
