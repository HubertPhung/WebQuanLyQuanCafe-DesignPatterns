import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db, ensureOrderTableGroups, ensureTableImages } from '@/lib/db'
import { adminOrders, adminTables, type FloorTable } from '@/lib/db/schema'
import { getMockReservations } from '@/lib/db/mock-store'
import { DEFAULT_BRANCH_ID, type BranchId } from '@/lib/branches'

type Details = { name: string; seats: number; zone: string; imageUrl: string | null; branch?: BranchId }

// The same local PostgreSQL tables used by getTables when Java is unavailable.
export async function saveDatabaseTable({ branch: requested, ...details }: Details, id?: number) {
  await ensureTableImages()
  return db.transaction(async tx => {
    // Coordinates id allocation and case-insensitive name checks across Next.js workers.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(174328102)`)
    const tables = await tx.select().from(adminTables).for('update')
    const current = id === undefined ? undefined : tables.find(table => table.id === id && !table.deletedAt)
    // An edited table stays at its branch; names only have to be unique within one branch.
    const branch = current?.branch ?? requested ?? DEFAULT_BRANCH_ID
    if (tables.some(table => !table.deletedAt && table.id !== id && table.branch === branch && table.name.toLowerCase() === details.name.toLowerCase())) throw new Error('Tên bàn đã tồn tại.')
    if (id === undefined) {
      const nextId = Math.max(0, ...tables.map(table => table.id)) + 1
      const [created] = await tx.insert(adminTables).values({ ...details, branch, id: nextId }).returning()
      return created
    }
    if (!current) throw new Error('Không tìm thấy bàn.')
    if (details.seats < current.guestCount) throw new Error('Số chỗ nhỏ hơn số khách đang ngồi.')
    for (const booking of getMockReservations()) {
      if (!booking.code.startsWith('RES-L')) continue
      const ids = booking.tableIds ?? (booking.tableId ? [booking.tableId] : [])
      if (!ids.includes(id) || !['Chờ xác nhận', 'Đã đặt'].includes(booking.status)) continue
      const capacity = ids.reduce((sum, selected) => sum + (selected === id ? details.seats : tables.find(table => table.id === selected)?.seats ?? 0), 0)
      if (capacity < booking.guests) throw new Error('Số chỗ nhỏ hơn số khách đã đặt bàn.')
    }
    const [updated] = await tx.update(adminTables).set({ ...details, updatedAt: new Date() }).where(eq(adminTables.id, id)).returning()
    return updated
  })
}

export async function deleteDatabaseTable(id: number) {
  await ensureTableImages()
  await ensureOrderTableGroups()
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(174328102)`)
    const [table] = await tx.select().from(adminTables).where(eq(adminTables.id, id)).for('update')
    if (!table || table.deletedAt) throw new Error('Không tìm thấy bàn.')
    const [order] = await tx.select({ id: adminOrders.id }).from(adminOrders)
      .where(sql`(${adminOrders.tableId} = ${id} OR ${adminOrders.tableIds} @> ${JSON.stringify([id])}::jsonb) AND (${adminOrders.status} <> 'completed' OR ${adminOrders.paymentStatus} = 'unpaid')`).limit(1)
    // Seeded sample bookings belong to the mock floor, not this database.
    const booking = getMockReservations().some(booking => booking.code.startsWith('RES-L') && ['Chờ xác nhận', 'Đã đặt'].includes(booking.status) && (booking.tableIds ?? [booking.tableId]).includes(id))
    if (table.status === 'occupied' || table.status === 'reserved' || order || booking) throw new Error('Bàn còn khách, đơn chưa kết thúc/thanh toán hoặc lịch đặt chưa xử lý. Vui lòng xử lý trước khi xóa.')
    await tx.update(adminTables).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(adminTables.id, id))
  })
}

// Java owns the floor while it runs; this keeps the database copy in step so the POS still sees
// the same tables when it falls back to the database. Mirror failures never undo the Java write.
export async function mirrorDatabaseTable(table: FloorTable) {
  try {
    await ensureTableImages()
    await db.insert(adminTables).values({
      id: table.id, name: table.name, seats: table.seats, zone: table.zone,
      branch: table.branch, imageUrl: table.imageUrl ?? null,
    }).onConflictDoUpdate({
      target: adminTables.id,
      set: { name: table.name, seats: table.seats, zone: table.zone, branch: table.branch, imageUrl: table.imageUrl ?? null, deletedAt: null, updatedAt: new Date() },
    })
  } catch (error) {
    console.warn('Saved the table in Java but not in the database copy:', error instanceof Error ? error.message : error)
  }
}

export async function mirrorDeletedTable(id: number) {
  try {
    await ensureTableImages()
    await db.update(adminTables).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(adminTables.id, id))
  } catch (error) {
    console.warn('Deleted the table in Java but not in the database copy:', error instanceof Error ? error.message : error)
  }
}
