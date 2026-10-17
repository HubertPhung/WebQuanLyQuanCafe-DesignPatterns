import 'server-only'
import { asc, desc, gte, ne } from 'drizzle-orm'
import { db, isDbConfigured } from '@/lib/db'
import { adminMenuItems, adminOrders, adminTables, type Order, type MenuItem, type FloorTable } from '@/lib/db/schema'
import { assertAdminAccess } from './access'
import {
  getMockMenuItems,
  getMockTables,
  getMockActiveOrders,
  getMockOrdersSince,
  getMockReservations,
  type ReservationStatusLabel,
} from '@/lib/db/mock-store'
import { fetchReservations } from '@/lib/api-client'

const DAY = 24 * 60 * 60 * 1000

function startOfDay(offsetDays = 0) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return new Date(date.getTime() - offsetDays * DAY)
}

export async function getMenuItems(): Promise<MenuItem[]> {
  assertAdminAccess()
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

export async function getTables(): Promise<FloorTable[]> {
  assertAdminAccess()
  if (!isDbConfigured || !db) {
    return getMockTables()
  }
  try {
    return await db.select().from(adminTables).orderBy(asc(adminTables.id))
  } catch (error) {
    console.warn('Database query failed, using fallback mock store:', error)
    return getMockTables()
  }
}

export async function getActiveOrders(): Promise<Order[]> {
  assertAdminAccess()
  if (!isDbConfigured || !db) {
    return getMockActiveOrders()
  }
  try {
    return await db.select().from(adminOrders).where(ne(adminOrders.status, 'completed')).orderBy(asc(adminOrders.createdAt))
  } catch (error) {
    console.warn('Database query failed, using fallback mock store:', error)
    return getMockActiveOrders()
  }
}

export async function getOrdersSince(days: number): Promise<Order[]> {
  assertAdminAccess()
  if (!isDbConfigured || !db) {
    return getMockOrdersSince(days)
  }
  try {
    return await db
      .select()
      .from(adminOrders)
      .where(gte(adminOrders.createdAt, startOfDay(days)))
      .orderBy(desc(adminOrders.createdAt))
  } catch (error) {
    console.warn('Database query failed, using fallback mock store:', error)
    return getMockOrdersSince(days)
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

export async function getOverview(days = 7) {
  const [orders, tables, menu] = await Promise.all([getOrdersSince(days), getTables(), getMenuItems()])
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
  }
}

export async function getHeaderData() {
  const [menu, active] = await Promise.all([getMenuItems(), getActiveOrders()])
  return {
    lowStock: menu
      .filter((item) => item.stockQty <= item.lowStockThreshold)
      .map((item) => ({ id: item.id, name: item.name, stockQty: item.stockQty, unit: item.unit })),
    readyOrders: active
      .filter((order) => order.status === 'ready')
      .map((order) => ({ id: order.id, orderCode: order.orderCode, customer: order.customer })),
    activeCount: active.filter((order) => order.status !== 'ready').length,
  }
}

export async function getCustomers() {
  const orders = await getOrdersSince(90)
  const customers = new Map<string, { name: string; orders: number; spent: number; lastVisit: Date }>()
  for (const order of orders) {
    if (order.customer === 'Walk-in') continue
    const entry = customers.get(order.customer) ?? { name: order.customer, orders: 0, spent: 0, lastVisit: order.createdAt }
    entry.orders += 1
    entry.spent += order.paymentStatus === 'paid' ? order.total : 0
    if (order.createdAt > entry.lastVisit) entry.lastVisit = order.createdAt
    customers.set(order.customer, entry)
  }
  return [...customers.values()].sort((a, b) => b.spent - a.spent)
}

export type ReservationView = {
  id: string
  // Where the booking lives decides how "Chuyển sang POS" converts it (Java Adapter or local mirror).
  source: 'java' | 'local'
  customer: string
  contact: string
  email: string
  dateTime: string
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

export async function getReservations(): Promise<{ reservations: ReservationView[]; javaOnline: boolean }> {
  assertAdminAccess()
  const local: ReservationView[] = getMockReservations().map((r) => ({
    id: r.code,
    source: 'local',
    customer: r.customer,
    contact: r.contact,
    email: r.email ?? '',
    dateTime: formatSlot(r.dateTime),
    table: r.tableName.replace('Table', 'Bàn'),
    tableId: r.tableId,
    guests: r.guests,
    status: r.status,
    note: r.note ?? '',
    preOrders: r.preOrders,
  }))

  const remote = await fetchReservations()
  if (!remote.ok) return { reservations: local, javaOnline: false }
  const fromJava: ReservationView[] = remote.data.map((r) => ({
    id: r.id,
    source: 'java',
    customer: r.customer,
    contact: r.contact,
    email: r.email ?? '',
    dateTime: formatSlot(new Date(r.dateTime)),
    table: r.table ?? (r.tableId ? `Bàn ${String(r.tableId).padStart(2, '0')}` : '—'),
    tableId: r.tableId,
    guests: r.guests,
    status: javaStatusLabels[r.status] ?? 'Chờ xác nhận',
    note: r.note ?? '',
    preOrders: r.preOrders ?? [],
  }))
  return { reservations: [...fromJava, ...local], javaOnline: true }
}
