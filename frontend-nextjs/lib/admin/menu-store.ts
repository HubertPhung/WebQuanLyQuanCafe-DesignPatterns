import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db, isDbConfigured, ensureMenuImageStorage } from '@/lib/db'
import { adminMenuItems } from '@/lib/db/schema'
import { createMockMenuItem, deleteMockMenuItem, setMockItemInStock, updateMockMenuItem, type NewMockItemInput } from '@/lib/db/mock-store'
import { deleteMenuLink, getMenuLinks, saveMenuLink } from './local-links'
import { normalizeMenuName } from './menu-link'

export type MenuCatalogInput = NewMockItemInput & { inStock?: boolean }

/** Persist the menu and its Java ID together; a database failure must never create a demo item. */
export async function persistMenuItem(input: MenuCatalogInput, javaMenuId?: number): Promise<number> {
  if (!isDbConfigured || !db) {
    const result = createMockMenuItem(input)
    if (!result.ok || result.id === undefined) throw new Error('Chưa lưu được món mới. Vui lòng thử lại.')
    if (input.inStock === false) setMockItemInStock(result.id, false)
    if (javaMenuId !== undefined) await saveMenuLink(result.id, javaMenuId)
    return result.id
  }
  await ensureMenuImageStorage()
  await getMenuLinks([]) // Initialize the link table before entering the short write transaction.
  try {
    return await db.transaction(async tx => {
      const name = normalizeMenuName(input.name)
      await tx.execute(sql`select pg_advisory_xact_lock(174328104, hashtext(${name}))`)
      const [existing] = await tx.select({ id: adminMenuItems.id }).from(adminMenuItems)
        .where(eq(sql`lower(btrim(${adminMenuItems.name}))`, name)).limit(1)
      const row = existing ?? (await tx.insert(adminMenuItems).values({
        ...input,
        inStock: input.inStock ?? true,
        recipe: input.recipe || null,
        imageUrl: input.imageUrl || null,
      }).returning({ id: adminMenuItems.id }))[0]
      if (!row) throw new Error('Menu insert did not return an ID')
      if (javaMenuId !== undefined) {
        await tx.execute(sql`insert into admin_menu_links (menu_item_id, java_menu_id)
          values (${row.id}, ${javaMenuId}) on conflict (menu_item_id)
          do update set java_menu_id = excluded.java_menu_id, linked_at = now()`)
      }
      return row.id
    })
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error
    console.error('Could not persist menu item:', cause instanceof Error ? cause.message : 'Database write failed')
    throw new Error('Chưa lưu được món vào thực đơn. Vui lòng thử lại.', { cause: error })
  }
}

/** Saves an edit of a menu item; a name another item already uses is refused. */
export async function updateMenuItemRecord(itemId: number, input: NewMockItemInput): Promise<void> {
  if (!isDbConfigured || !db) {
    const result = updateMockMenuItem(itemId, input)
    if (!result.ok) throw new Error(result.error)
    return
  }
  await ensureMenuImageStorage()
  const name = normalizeMenuName(input.name)
  const outcome = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(174328104, hashtext(${name}))`)
    const [clash] = await tx.select({ id: adminMenuItems.id }).from(adminMenuItems)
      .where(sql`lower(btrim(${adminMenuItems.name})) = ${name} and ${adminMenuItems.id} <> ${itemId}`).limit(1)
    if (clash) return 'taken' as const
    const updated = await tx.update(adminMenuItems).set({
      ...input,
      recipe: input.recipe || null,
      imageUrl: input.imageUrl || null,
    }).where(eq(adminMenuItems.id, itemId)).returning({ id: adminMenuItems.id })
    return updated.length === 0 ? 'missing' as const : 'saved' as const
  })
  if (outcome === 'taken') throw new Error('Tên món đã có trong thực đơn.')
  if (outcome === 'missing') throw new Error('Không tìm thấy món trong thực đơn.')
}

/** Removes a menu item and its Java link. Orders keep the name and price they were sold at. */
export async function deleteMenuItemRecord(itemId: number): Promise<void> {
  if (!isDbConfigured || !db) {
    const result = deleteMockMenuItem(itemId)
    if (!result.ok) throw new Error(result.error)
    await deleteMenuLink(itemId)
    return
  }
  await getMenuLinks([]) // Make sure the link table exists before the transaction uses it.
  const removed = await db.transaction(async tx => {
    await tx.execute(sql`delete from admin_menu_links where menu_item_id = ${itemId}`)
    return tx.delete(adminMenuItems).where(eq(adminMenuItems.id, itemId)).returning({ id: adminMenuItems.id })
  })
  if (removed.length === 0) throw new Error('Không tìm thấy món trong thực đơn.')
}
