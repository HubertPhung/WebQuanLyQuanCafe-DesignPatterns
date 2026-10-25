import 'server-only'
import { fetchMenu } from '@/lib/api-client'
import { deleteMenuLink, getMenuLinks, saveMenuLink } from './local-links'

export function normalizeMenuName(name: string) {
  return name.normalize('NFC').trim().toLowerCase()
}

/**
 * Id món bên Java cho các món frontend. Liên kết đã lưu được ưu tiên miễn Java vẫn còn id đó, nên
 * đổi tên món ở bên nào cũng không sao; món gặp lần đầu được ghép theo tên một lần rồi lưu lại. Món
 * Java không bán thì không có trong bảng ánh xạ. Trả về null khi không đọc được thực đơn Java.
 */
export async function resolveJavaMenuIds(items: { id: number; name: string }[]): Promise<Map<number, number> | null> {
  const javaMenu = await fetchMenu()
  if (!javaMenu.ok) return null

  const javaIds = new Set(javaMenu.data.map((item) => item.id))
  const javaIdByName = new Map<string, number>()
  for (const item of javaMenu.data) {
    if (!javaIdByName.has(normalizeMenuName(item.name))) javaIdByName.set(normalizeMenuName(item.name), item.id)
  }

  const stored = await getMenuLinks(items.map((item) => item.id))
  const resolved = new Map<number, number>()
  for (const item of items) {
    const linked = stored.get(item.id)
    if (linked !== undefined && javaIds.has(linked)) {
      resolved.set(item.id, linked)
      continue
    }
    if (linked !== undefined) await deleteMenuLink(item.id) // Java đã xóa món đó
    const byName = javaIdByName.get(normalizeMenuName(item.name))
    if (byName !== undefined) {
      resolved.set(item.id, byName)
      await saveMenuLink(item.id, byName)
    }
  }
  return resolved
}

export { saveMenuLink as linkMenuItem }
