import 'server-only'
import { fetchMenu } from '@/lib/api-client'
import { deleteMenuLink, getMenuLinks, saveMenuLink } from './local-links'

export function normalizeMenuName(name: string) {
  return name.normalize('NFC').trim().toLowerCase()
}

/**
 * Java menu ids for frontend menu items. A stored link wins as long as Java still has that id,
 * so renaming an item on either side keeps working; an item seen for the first time is matched
 * by name once and the match is stored. Items Java does not sell are left out of the map.
 * Returns null when the Java menu cannot be read.
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
    if (linked !== undefined) await deleteMenuLink(item.id) // Java removed that item
    const byName = javaIdByName.get(normalizeMenuName(item.name))
    if (byName !== undefined) {
      resolved.set(item.id, byName)
      await saveMenuLink(item.id, byName)
    }
  }
  return resolved
}

export { saveMenuLink as linkMenuItem }
