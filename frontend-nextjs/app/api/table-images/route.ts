import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getSession } from '@/lib/auth/session'

export const runtime = 'nodejs'
const directory = path.join(process.cwd(), '.data', 'table-images')
const LIMIT = 2 * 1024 * 1024

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || !['MANAGER', 'ADMIN'].includes(session.role)) return Response.json({ error: 'Không có quyền tải ảnh bàn.' }, { status: 403 })
  if (Number(request.headers.get('content-length') ?? 0) > LIMIT + 65536) return Response.json({ error: 'Ảnh tối đa 2 MB.' }, { status: 413 })
  const form = await request.formData()
  const image = form.get('image')
  if (!(image instanceof File) || image.size === 0 || image.size > LIMIT) return Response.json({ error: 'Chọn ảnh JPG, PNG hoặc WebP tối đa 2 MB.' }, { status: 400 })
  const bytes = Buffer.from(await image.arrayBuffer())
  const extension = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpg'
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null
  if (!extension) return Response.json({ error: 'Định dạng ảnh không hợp lệ. Chỉ nhận JPG, PNG, WebP.' }, { status: 400 })
  const name = `${randomUUID()}.${extension}`
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, name), bytes, { flag: 'wx' })
  return Response.json({ url: `/api/table-images?name=${name}` }, { status: 201 })
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session || !['STAFF', 'MANAGER', 'ADMIN'].includes(session.role)) return new Response(null, { status: 403 })
  const name = new URL(request.url).searchParams.get('name') ?? ''
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(name)) return new Response(null, { status: 404 })
  try {
    const bytes = await readFile(path.join(directory, name))
    return new Response(bytes, { headers: { 'Content-Type': `image/${name.endsWith('.jpg') ? 'jpeg' : name.split('.').pop()}`, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Response(null, { status: 404 })
    throw error
  }
}
