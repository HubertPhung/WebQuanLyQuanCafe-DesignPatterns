import 'server-only'
import { and, asc, desc, eq, gte, inArray, ne, isNull } from 'drizzle-orm'
import { db, isDbConfigured, ensureOrderTableGroups, ensureTableImages } from '@/lib/db'
import { adminMenuItems, adminOrders, adminTables, type Order, type MenuItem, type FloorTable } from '@/lib/db/schema'
import { assertAdminAccess } from './access'
import { getAdminBranch } from './branch'
import {
  getMockMenuItems,
  getMockTables,
  getMockActiveOrders,
  getMockOrdersSince,
  getMockAllOrders,
  getMockReservations,
  getMockOrdersByCode,
  type ReservationStatusLabel,
} from '@/lib/db/mock-store'
import { fetchAnalytics, fetchCustomers, fetchReservations, fetchTables } from '@/lib/api-client'
import { listSyncQueue } from './local-links'
import { listOrderContacts, type OrderContact } from '@/lib/orders/online-contacts'

const DAY = 24 * 60 * 60 * 1000

function startOfDay(offsetDays = 0) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return new Date(date.getTime() - offsetDays * DAY)
}

export async function getMenuItems(): Promise<MenuItem[]> {
  await assertAdminAccess()
  if (!isDbConfigured || !db) {
    return getMockMenuItems()
  }
  try {
    return await db.select().from(adminMenuItems).orderBy(asc(adminMenuItems.category), asc(adminMenuItems.name))
  } catch (error) {
    console.warn('Database query failed, using fallback mock store:', error)
    return getMockMenuItems()
  }
}

// The floor of the branch chosen in the admin header.
export async function getTables(): Promise<FloorTable[]> {
  await assertAdminAccess()
  const branch = await getAdminBranch()
  const remote = await fetchTables(branch)
  if (remote.ok) return remote.data.map(t => ({ ...t, occupiedSince: t.occupiedSince ? new Date(t.occupiedSince) : null, updatedAt: new Date() }))
  const mock = () => getMockTables().filter((table) => table.branch === branch)
  if (!isDbConfigured || !db) {
    return mock()
  }
  try {
    await ensureTableImages()
    return await db.select().from(adminTables)
      .where(and(isNull(adminTables.deletedAt), eq(adminTables.branch, branch)))
      .orderBy(asc(adminTables.id))
  } catch (error) {
    console.warn('Database query failed, using fallback mock store:', error)
    return mock()
  }
}

// Open orders of the chosen branch: the KDS, the POS tabs and the header counts.
export async function getActiveOrders(): Promise<Order[]> {
  await assertAdminAccess()
  await ensureOrderTableGroups()
  const branch = await getAdminBranch()
  const mock = () => getMockActiveOrders().filter((order) => order.branch === branch)
  if (!isDbConfigured || !db) {
    return mock()
  }
  try {
    return await db.select().from(adminOrders)
      .where(and(ne(adminOrders.status, 'completed'), ne(adminOrders.status, 'cancelled'), eq(adminOrders.branch, branch)))
      .orderBy(asc(adminOrders.createdAt))
  } catch (error) {
    console.warn('Database query failed, using fallback mock store:', error)
    return mock()
  }
}

// Orders of the chosen branch, or of the whole shop for figures that are shared (customers).
export async function getOrdersSince(days: number, scope: 'branch' | 'all' = 'branch'): Promise<Order[]> {
  await assertAdminAccess()
  await ensureOrderTableGroups()
  const branch = scope === 'branch' ? await getAdminBranch() : null
  const mock = () => getMockOrdersSince(days).filter((order) => !branch || order.branch === branch)
  if (!isDbConfigured || !db) {
    return mock()
  }
  try {
    return await db
      .select()
      .from(adminOrders)
      .where(and(gte(adminOrders.createdAt, startOfDay(days)), branch ? eq(adminOrders.branch, branch) : undefined))
      .orderBy(desc(adminOrders.createdAt))
  } catch (error) {
    console.warn('Database query failed, using fallback mock store:', error)
    return mock()
  }
}

function fulfillmentMinutes(orders: Order[]) {
  const done = orders.filter((order) => order.completedAt)
  if (done.length === 0) return 0
  const total = done.reduce((sum, order) => sum + (order.completedAt!.getTime() - order.createdAt.getTime()), 0)
  return Math.round((total / done.length / 60000) * 10) / 10
}

function revenue(orders: Order[]) {
  return orders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + order.total, 0)
}

export type DataSource = 'java' | 'local'

// Chart data computed by GET /api/analytics/overview, in the shape the dashboard widgets use.
async function getJavaOverview(days: number) {
  const remote = await fetchAnalytics(days, await getAdminBranch())
  if (!remote.ok) return null
  const analytics = remote.data
  return {
    metrics: {
      revenueToday: analytics.revenueToday,
      revenueYesterday: analytics.revenueYesterday,
      ordersToday: analytics.ordersToday,
      ordersYesterday: analytics.ordersYesterday,
      activeTables: analytics.tables.occupied,
      totalTables: analytics.tables.total,
      fulfillmentToday: analytics.fulfillmentMinutesToday,
      fulfillmentYesterday: analytics.fulfillmentMinutesYesterday,
    },
    revenueByDay: analytics.revenueByDay.map((row) => ({
      day: new Date(`${row.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: Math.round(row.revenue * 100) / 100,
      orders: row.orders,
    })),
    topDrinks: analytics.topItems.map((item) => ({ name: item.name, sold: item.qty })),
    paymentMix: (['cash', 'qr', 'card'] as const).map((method) => ({
      method,
      total: Math.round((analytics.paymentMix[method] ?? 0) * 100) / 100,
    })),
  }
}

// Java's analytics when it answers (orders it priced or imported), otherwise the local store.
export async function getOverview(days = 7) {
  const [orders, tables, menu, fromJava] = await Promise.all([
    getOrdersSince(days),
    getTables(),
    getMenuItems(),
    getJavaOverview(days),
  ])
  if (fromJava) return { ...fromJava, recentOrders: orders.slice(0, 12), source: 'java' as DataSource }
  const todayStart = startOfDay().getTime()
  const yesterdayStart = startOfDay(1).getTime()
  const today = orders.filter((order) => order.createdAt.getTime() >= todayStart)
  const yesterday = orders.filter(
    (order) => order.createdAt.getTime() >= yesterdayStart && order.createdAt.getTime() < todayStart,
  )

  const revenueByDay = Array.from({ length: days }, (_, index) => {
    const start = startOfDay(days - 1 - index)
    const end = start.getTime() + DAY
    const dayOrders = orders.filter((order) => order.createdAt >= start && order.createdAt.getTime() < end)
    return {
      day: start.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: Math.round(revenue(dayOrders) * 100) / 100,
      orders: dayOrders.length,
    }
  })

  const drinkCategories = new Set(menu.filter((item) => item.category !== 'Pastry' && item.kind === 'menu').map((item) => item.name))
  const drinkTotals = new Map<string, number>()
  for (const order of orders) {
    for (const item of order.items) {
      if (drinkCategories.has(item.name)) drinkTotals.set(item.name, (drinkTotals.get(item.name) ?? 0) + item.qty)
    }
  }
  const topDrinks = [...drinkTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, sold]) => ({ name, sold }))

  const paymentMix = (['cash', 'qr', 'card'] as const).map((method) => ({
    method,
    total: Math.round(revenue(orders.filter((order) => order.paymentMethod === method)) * 100) / 100,
  }))

  const occupied = tables.filter((table) => table.status === 'occupied').length

  return {
    metrics: {
      revenueToday: revenue(today),
      revenueYesterday: revenue(yesterday),
      ordersToday: today.length,
      ordersYesterday: yesterday.length,
      activeTables: occupied,
      totalTables: tables.length,
      fulfillmentToday: fulfillmentMinutes(today),
      fulfillmentYesterday: fulfillmentMinutes(yesterday),
    },
    revenueByDay,
    topDrinks,
    paymentMix,
    recentOrders: orders.slice(0, 12),
    source: 'local' as DataSource,
  }
}

// What needs a staff action right now, shown in the header bell and as sidebar badges; each
// entry links to the page that resolves it.
export async function getHeaderData() {
  const [active, { reservations }, pendingSync] = await Promise.all([getActiveOrders(), getReservations(), getPendingSyncCount()])
  return {
    readyOrders: active
      .filter((order) => order.status === 'ready')
      .map((order) => ({ id: order.id, orderCode: order.orderCode, customer: order.customer })),
    pendingReservations: reservations
      .filter((reservation) => reservation.status === 'Chờ xác nhận')
      .map((reservation) => ({ id: reservation.id, customer: reservation.customer, dateTime: reservation.dateTime, guests: reservation.guests })),
    pendingSync,
    // Same count as the kitchen tab: every order the bar has not completed yet.
    activeCount: active.length,
  }
}

export type CustomerView = { name: string; orders: number; spent: number; lastVisit: Date; points?: number; rank?: string }

// Loyalty members from GET /api/customers (with points and rank); without Java, a 90-day
// summary of the local orders by customer name.
export async function getCustomers(): Promise<{ customers: CustomerView[]; source: DataSource }> {
  await assertAdminAccess()
  const remote = await fetchCustomers()
  if (remote.ok) {
    return {
      source: 'java',
      customers: remote.data.map((customer) => ({
        name: customer.name,
        orders: customer.totalOrders,
        spent: customer.totalSpent,
        lastVisit: customer.lastVisit ? new Date(customer.lastVisit) : new Date(0),
        points: customer.loyaltyPoints,
        rank: customer.rank,
      })),
    }
  }
  // Members are shared by both branches, so the summary counts every order.
  const orders = await getOrdersSince(90, 'all')
  const customers = new Map<string, CustomerView>()
  for (const order of orders) {
    if (order.customer === 'Walk-in') continue
    const entry = customers.get(order.customer) ?? { name: order.customer, orders: 0, spent: 0, lastVisit: order.createdAt }
    entry.orders += 1
    entry.spent += order.paymentStatus === 'paid' ? order.total : 0
    if (order.createdAt > entry.lastVisit) entry.lastVisit = order.createdAt
    customers.set(order.customer, entry)
  }
  return { customers: [...customers.values()].sort((a, b) => b.spent - a.spent), source: 'local' }
}

// Orders recorded locally that the Java backend has not received yet.
export async function getPendingSyncCount(): Promise<number> {
  await assertAdminAccess()
  return (await listSyncQueue()).length
}

export type ReservationView = {
  tableIds?: number[]
  id: string
  // Where the booking lives decides how "Chuyển sang POS" converts it (Java Adapter or local mirror).
  source: 'java' | 'local'
  customer: string
  contact: string
  email: string
  dateTime: string
  scheduledAt: string
  table: string
  tableId: number | null
  guests: number
  status: ReservationStatusLabel
  note: string
  preOrders: { name: string; qty: number; price: number }[]
}

// Java ReservationStatus descriptions → the four labels the reservations page works with.
const javaStatusLabels: Record<string, ReservationStatusLabel> = {
  'Chờ xác nhận': 'Chờ xác nhận',
  'Đã xác nhận đặt bàn': 'Đã đặt',
  'Khách đã nhận bàn': 'Hoàn thành',
  'Đã hủy': 'Đã hủy',
}

function formatSlot(date: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

// Bookings of the chosen branch.
export async function getReservations(): Promise<{ reservations: ReservationView[]; javaOnline: boolean }> {
  await assertAdminAccess()
  const branch = await getAdminBranch()
  const local: ReservationView[] = (isDbConfigured ? [] : getMockReservations()).filter((r) => r.branch === branch).map((r) => ({
    id: r.code,
    source: 'local',
    customer: r.customer,
    contact: r.contact,
    email: r.email ?? '',
    dateTime: formatSlot(r.dateTime),
    scheduledAt: r.dateTime.toISOString(),
    table: r.tableName.replace('Table', 'Bàn'),
    tableId: r.tableId,
    tableIds: r.tableIds,
    guests: r.guests,
    status: r.status,
    note: r.note ?? '',
    preOrders: r.preOrders,
  }))

  const remote = await fetchReservations(branch)
  if (!remote.ok) return { reservations: local, javaOnline: false }
  const fromJava: ReservationView[] = remote.data.map((r) => ({
    id: r.id,
    source: 'java',
    customer: r.customer,
    contact: r.contact,
    email: r.email ?? '',
    dateTime: formatSlot(new Date(r.dateTime)),
    scheduledAt: r.dateTime,
    table: r.table ?? (r.tableId ? `Bàn ${String(r.tableId).padStart(2, '0')}` : '—'),
    tableId: r.tableId,
    tableIds: r.tableIds,
    guests: r.guests,
    status: javaStatusLabels[r.status] ?? 'Chờ xác nhận',
    note: r.note ?? '',
    preOrders: r.preOrders ?? [],
  }))
  return { reservations: [...fromJava, ...local], javaOnline: true }
}

export type OnlineOrderView = Order & { contact: OrderContact }

// Storefront orders, newest first: the order rows the POS and kitchen share, joined with the
// contact and delivery details placeOnlineOrder stored for them.
// Storefront orders picked up at or delivered from the chosen branch.
export async function getOnlineOrders(): Promise<OnlineOrderView[]> {
  await assertAdminAccess()
  const branch = await getAdminBranch()
  return (await joinContactOrders(await listOrderContacts())).filter((order) => order.branch === branch)
}

// The order rows behind the given contacts, in the contacts' order. The caller has already
// scoped the contacts (all of them for staff, one account's own for /account).
export async function joinContactOrders(contacts: OrderContact[]): Promise<OnlineOrderView[]> {
  await ensureOrderTableGroups()
  if (contacts.length === 0) return []
  const codes = contacts.map((contact) => contact.orderCode)
  let orders: Order[] = getMockOrdersByCode(codes)
  if (isDbConfigured && db) {
    try {
      orders = await db.select().from(adminOrders).where(inArray(adminOrders.orderCode, codes))
    } catch (error) {
      console.warn('Database query failed, using fallback mock store:', error)
    }
  }
  const byCode = new Map(orders.map((order) => [order.orderCode, order]))
  return contacts.flatMap((contact) => {
    const order = byCode.get(contact.orderCode)
    return order ? [{ ...order, contact }] : []
  })
}

export type OrderHistoryItem = Order & {
  contact: OrderContact | null
  tableName: string | null
}

// All transactions and orders (online, takeaway, dine-in at table/POS), sorted newest first.
export async function getOrderHistory(scope: 'branch' | 'all' = 'branch'): Promise<OrderHistoryItem[]> {
  await assertAdminAccess()
  await ensureOrderTableGroups()
  const branch = scope === 'branch' ? await getAdminBranch() : null
  const [contacts, tables] = await Promise.all([
    listOrderContacts(),
    getTables(),
  ])
  const contactMap = new Map(contacts.map((c) => [c.orderCode, c]))
  const tableMap = new Map(tables.map((t) => [t.id, t.name]))

  let orders: Order[] = []
  if (isDbConfigured && db) {
    try {
      orders = await db
        .select()
        .from(adminOrders)
        .where(branch ? eq(adminOrders.branch, branch) : undefined)
        .orderBy(desc(adminOrders.createdAt))
    } catch (error) {
      console.warn('Database query failed, using fallback mock store:', error)
      orders = getMockAllOrders().filter((o) => !branch || o.branch === branch)
    }
  } else {
    orders = getMockAllOrders().filter((o) => !branch || o.branch === branch)
  }

  return orders.map((order) => {
    const contact = contactMap.get(order.orderCode) ?? null
    let tableName: string | null = null
    if (order.tableIds && order.tableIds.length > 0) {
      tableName = order.tableIds.map((id) => tableMap.get(id) ?? `Bàn #${id}`).join(', ')
    } else if (order.tableId) {
      tableName = tableMap.get(order.tableId) ?? `Bàn #${order.tableId}`
    }
    return {
      ...order,
      contact,
      tableName,
    }
  })
}
