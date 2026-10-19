import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const library = path.join(root, 'frontend-nextjs/public/vendor/vis-network/vis-network.min.js')
// Fail before changing HTML if the bundled library is missing.
await readFile(library)

async function localize(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await localize(file)
    } else if (entry.name.endsWith('.html')) {
      const html = await readFile(file, 'utf8')
      const relative = path.relative(directory, library).split(path.sep).join('/')
      // CDN integrity/crossorigin attributes prevent file:// usage in browsers.
      const updated = html.replace(/<script\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*>\s*<\/script>/gi, (tag, _quote, src) => {
        return src === 'https://unpkg.com/vis-network@9.1.6/standalone/umd/vis-network.min.js'
          || src.endsWith('frontend-nextjs/public/vendor/vis-network/vis-network.min.js')
          ? `<script src="${relative}"></script>` : tag
      })
      if (updated !== html) {
        await writeFile(file, updated)
        console.log(`Local assets: ${path.relative(root, file)}`)
      }
    }
  }
}

await localize(path.join(root, 'graphify-out'))
