'use server'

import { eq, inArray, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, isDbConfigured } from '@/lib/db'
import {
  adminMenuItems,
  adminOrders,
  adminTables,
  orderStatuses,
  orderTypes,
  paymentMethods,
  tableStatuses,
  type MenuItem,
  type Order,
  type OrderItem,
  type OrderStatus,
  type TableStatus,
  type Variation,
} from '@/lib/db/schema'
import { assertAdminAccess } from '@/lib/admin/access'
import { TAX_RATE } from '@/lib/admin/format'
import {
  customizationSurcharge,
  describeCustomizations,
  isPosCustomization,
  normalizeCustomizations,
} from '@/lib/admin/customizations'
import {
  checkout,
  createJavaMenuItem,
  createReservation as createJavaReservation,
  findCustomerByPhone,
  payJavaOrder,
  transferReservation as transferJavaReservation,
  updateJavaOrderStatus,
  updateJavaReservationStatus,
  updateJavaStock,
  updateTable,
  syncJavaOrders,
  type CheckoutPayload,
  type CheckoutReceipt,
  type JavaResult,
  type SyncOrderPayload,
} from '@/lib/api-client'
import { dequeueSync, enqueueSync, listSyncQueue } from '@/lib/admin/local-links'
import { linkMenuItem, normalizeMenuName, resolveJavaMenuIds } from '@/lib/admin/menu-link'
import {
  updateMockOrderStatus,
  markMockOrderPaid,
  updateMockTableStatus,
  setMockItemInStock,
  createMockOrder,
  createMockMenuItem,
  getMockMenuItems,
  createMockReservation,
  createMockOrderFromItems,
  getMockOrder,
  getMockOrdersByCode,
  updateMockReservationStatus,
  reservationStatuses,
  type ReservationStatusLabel,
  transferMockReservation,
  type ExternalOrderInput,
  type NewMockOrderInput,
} from '@/lib/db/mock-store'

type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

function refresh() {
  revalidatePath('/admin', 'layout')
}

function fail(error: unknown): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : 'Something went wrong.' }
}

type LocalOrderRef = Pick<Order, 'orderCode' | 'tableId' | 'paymentMethod'>

// Code and table of a frontend order: the database first, then the mock store.
async function findLocalOrder(orderId: number): Promise<LocalOrderRef | null> {
  if (isDbConfigured && db) {
    try {
      const [row] = await db
        .select({ orderCode: adminOrders.orderCode, tableId: adminOrders.tableId, paymentMethod: adminOrders.paymentMethod })
        .from(adminOrders)
        .where(eq(adminOrders.id, orderId))
      if (row) return row
    } catch {
      // Fall through to the mock store, like the writes below.
    }
  }
  const mock = getMockOrder(orderId)
  return mock ? { orderCode: mock.orderCode, tableId: mock.tableId, paymentMethod: mock.paymentMethod } : null
}

// Java only knows the orders it priced or opened, and for those its answer is final.
// Unreachable, or 404 for an order recorded locally (e.g. while Java was down): keep it local.
function javaRefusal(result: JavaResult<unknown>): string | null {
  if (result.ok || result.unreachable || result.status === 404) return null
  return result.error
}

export async function updateOrderStatus(orderId: number, status: OrderStatus): Promise<ActionResult> {
  try {
    assertAdminAccess()
    if (!Number.isInteger(orderId) || !orderStatuses.includes(status)) throw new Error('Invalid order update.')
    const local = await findLocalOrder(orderId)
    if (local) {
      const refused = javaRefusal(await updateJavaOrderStatus(local.orderCode, status))
      if (refused) return { ok: false, error: refused }
    }
    if (!isDbConfigured || !db) {
      const res = updateMockOrderStatus(orderId, status)
      refresh()
      return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'Failed' }
    }
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(adminOrders)
          .set({ status, completedAt: status === 'completed' ? new Date() : null })
          .where(eq(adminOrders.id, orderId))
        // Mirrors the Java TableStatusSyncObserver: a finished dine-in order frees its table for cleaning.
        if (status === 'completed' && local?.tableId) {
          await tx
            .update(adminTables)
            .set({ status: 'cleaning', guestCount: 0, occupiedSince: null, updatedAt: new Date() })
            .where(eq(adminTables.id, local.tableId))
        }
      })
    } catch {
      updateMockOrderStatus(orderId, status)
    }
    refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export async function markOrderPaid(orderId: number): Promise<ActionResult> {
  try {
    assertAdminAccess()
    if (!Number.isInteger(orderId)) throw new Error('Invalid order.')
    const local = await findLocalOrder(orderId)
    if (local) {
      const refused = javaRefusal(await payJavaOrder(local.orderCode, local.paymentMethod))
      if (refused) return { ok: false, error: refused }
    }
    if (!isDbConfigured || !db) {
      const res = markMockOrderPaid(orderId)
      refresh()
      return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'Failed' }
    }
    try {
      await db.update(adminOrders).set({ paymentStatus: 'paid' }).where(eq(adminOrders.id, orderId))
    } catch {
      markMockOrderPaid(orderId)
    }
    refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

// Digits only, as the Java customer store keeps phone numbers ("0908 123 456" -> "0908123456").
function normalizePhone(raw: string | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15 ? digits : null
}

export type Member = { name: string; phone: string; points: number; rank: string }
export type MemberLookup = { ok: true; member: Member | null; offline: boolean } | { ok: false; error: string }

// POS member lookup through GET /api/customers?phone=... (members live in the Java store).
export async function lookupMember(phone: string): Promise<MemberLookup> {
  try {
    assertAdminAccess()
    const digits = normalizePhone(phone)
    if (!digits) throw new Error('Enter a phone number with 8 to 15 digits.')
    const result = await findCustomerByPhone(digits)
    if (result.ok) {
      const customer = result.data[0]
      return {
        ok: true,
        offline: false,
        member: customer
          ? { name: customer.name, phone: customer.phone, points: customer.loyaltyPoints, rank: customer.rank }
          : null,
      }
    }
    if (result.unreachable) return { ok: true, member: null, offline: true }
    return { ok: false, error: result.error }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Something went wrong.' }
  }
}

type NewOrderInput = {
  lines: { menuItemId: number; qty: number; variation?: string; customizations?: string[] }[]
  customer: string
  tableId: number | null
  orderType: string
  paymentMethod: string
  paid: boolean
  // Member phone and the loyalty points to redeem; redeeming needs the Java backend.
  customerPhone?: string
  useLoyaltyPoints?: number
}

type LocalMenuItem = Pick<MenuItem, 'id' | 'name' | 'kind' | 'inStock' | 'variations'>

type CheckoutOutcome =
  | { kind: 'accepted'; receipt: CheckoutReceipt }
  // javaDown: Java did not answer, so pushing the local copy right away is pointless.
  | { kind: 'local'; javaDown: boolean }
  | { kind: 'rejected'; error: string }

async function loadLocalMenu(ids: number[]): Promise<LocalMenuItem[]> {
  if (isDbConfigured && db) {
    try {
      return await db.select().from(adminMenuItems).where(inArray(adminMenuItems.id, ids))
    } catch {
      // Same degradation as the writes below: an unreachable database means the mock store.
    }
  }
  return getMockMenuItems().filter((item) => ids.includes(item.id))
}

// The two stores number their menus independently; menu-link keeps the id pairs.
// A line the backend cannot price (unknown item, paid variation) keeps the order local.
// Size L and toppings are sent as Java customizations, priced there by the Decorators.
async function toJavaLines(
  lines: LocalOrderInput['lines'],
  localMenu: LocalMenuItem[],
): Promise<CheckoutPayload['lines'] | 'unreachable' | 'unmapped'> {
  const javaIds = await resolveJavaMenuIds(localMenu)
  if (!javaIds) return 'unreachable'
  const localById = new Map(localMenu.map((item) => [item.id, item]))

  const javaLines: CheckoutPayload['lines'] = []
  for (const line of lines) {
    const local = localById.get(line.menuItemId)
    if (!local) return 'unmapped'
    const variation = line.variation ? local.variations.find((option) => option.name === line.variation) : undefined
    if (variation && variation.price > 0) return 'unmapped'
    const javaId = javaIds.get(local.id)
    if (javaId === undefined) return 'unmapped'
    javaLines.push({ menuItemId: javaId, qty: line.qty, customizations: line.customizations ?? [] })
  }
  return javaLines
}

type LocalOrderInput = NewMockOrderInput

type MemberCheckout = { customerPhone?: string; useLoyaltyPoints?: number }

async function forwardCheckout(
  order: LocalOrderInput,
  localMenu: LocalMenuItem[],
  member: MemberCheckout,
): Promise<CheckoutOutcome> {
  // POST /api/checkout always takes payment, so open tabs are recorded locally and synced.
  if (!order.paid) return { kind: 'local', javaDown: false }
  const lines = await toJavaLines(order.lines, localMenu)
  if (lines === 'unreachable') return { kind: 'local', javaDown: true }
  if (lines === 'unmapped') return { kind: 'local', javaDown: false }

  const receipt = await checkout({
    lines,
    customer: order.customer,
    tableId: order.tableId,
    orderType: order.orderType,
    paymentMethod: order.paymentMethod,
    ...member,
  })
  if (receipt.ok) return { kind: 'accepted', receipt: receipt.data }
  return receipt.unreachable ? { kind: 'local', javaDown: true } : { kind: 'rejected', error: receipt.error }
}

// Order codes the frontend issues itself; Java-priced orders keep the code Java returned.
function newLocalOrderCode() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6)
  const random = Math.floor(Math.random() * 36 ** 3).toString(36).toUpperCase().padStart(3, '0')
  return `AC-${stamp}-${random}`
}

async function recordOrderLocally(input: LocalOrderInput, quantities: Map<number, number>): Promise<ActionResult> {
  if (!isDbConfigured || !db) {
    const res = createMockOrder(input)
    return res.ok ? { ok: true, message: res.message } : { ok: false, error: res.error ?? 'Failed' }
  }

  try {
    const menu = await db.select().from(adminMenuItems).where(inArray(adminMenuItems.id, [...quantities.keys()]))
    const byId = new Map(menu.map((item) => [item.id, item]))

    const items: OrderItem[] = input.lines.map((line) => {
      const item = byId.get(line.menuItemId)
      if (!item || item.kind !== 'menu' || !item.inStock) throw new Error('One of the items is no longer available.')
      const variation = line.variation ? item.variations.find((option: Variation) => option.name === line.variation) : undefined
      if (line.variation && !variation) throw new Error(`Invalid option for ${item.name}.`)
      const customizations = line.customizations ?? []
      return {
        name: item.name,
        qty: line.qty,
        price: item.sellPrice + (variation?.price ?? 0) + customizationSurcharge(customizations),
        variation: [variation?.name, describeCustomizations(customizations)].filter(Boolean).join(' · ') || undefined,
      }
    })

    // Java's receipt wins when it priced the order (member discount, redeemed points).
    const subtotal = input.totals?.subtotal ?? Math.round(items.reduce((sum, item) => sum + item.price * item.qty, 0) * 100) / 100
    const total = input.totals?.total ?? Math.round(subtotal * (1 + TAX_RATE) * 100) / 100
    const customer = input.customer.trim().slice(0, 60) || 'Walk-in'

    await db.transaction(async (tx) => {
      const [{ next }] = await tx.execute<{ next: number }>(
        sql`select coalesce(max(id), 0) + 1 as next from admin_orders`,
      ).then((result) => result.rows)
      await tx.insert(adminOrders).values({
        orderCode: input.orderCode ?? `AC-${String(next).padStart(4, '0')}-${Date.now().toString(36).slice(-3).toUpperCase()}`,
        customer,
        tableId: input.tableId,
        orderType: input.orderType,
        items,
        subtotal,
        total,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paid ? 'paid' : 'unpaid',
        status: 'pending',
      })
      for (const [id, qty] of quantities) {
        await tx
          .update(adminMenuItems)
          .set({ stockQty: sql`greatest(${adminMenuItems.stockQty} - ${qty}, 0)` })
          .where(eq(adminMenuItems.id, id))
      }
      if (input.tableId) {
        await tx
          .update(adminTables)
          .set({ status: 'occupied', occupiedSince: sql`coalesce(${adminTables.occupiedSince}, now())`, updatedAt: new Date() })
          .where(eq(adminTables.id, input.tableId))
      }
    })
    return { ok: true, message: `Order sent to the bar for ${customer}.` }
  } catch {
    const res = createMockOrder(input)
    return res.ok ? { ok: true, message: res.message } : { ok: false, error: res.error ?? 'Failed' }
  }
}

export async function createOrder(input: NewOrderInput): Promise<ActionResult> {
  try {
    assertAdminAccess()
    const orderType = orderTypes.find((type) => type === input.orderType)
    const paymentMethod = paymentMethods.find((method) => method === input.paymentMethod)
    if (!orderType || !paymentMethod) throw new Error('Choose a valid order type and payment method.')
    if (input.lines.length === 0 || input.lines.length > 40) throw new Error('Add between 1 and 40 lines.')

    const quantities = new Map<number, number>()
    const lines: LocalOrderInput['lines'] = []
    for (const line of input.lines) {
      if (!Number.isInteger(line.menuItemId) || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 50) {
        throw new Error('Each line needs a whole quantity between 1 and 50.')
      }
      const requested = line.customizations ?? []
      if (!Array.isArray(requested) || !requested.every(isPosCustomization) || new Set(requested).size !== requested.length) {
        throw new Error('Choose valid size and topping options.')
      }
      quantities.set(line.menuItemId, (quantities.get(line.menuItemId) ?? 0) + line.qty)
      lines.push({ menuItemId: line.menuItemId, qty: line.qty, variation: line.variation, customizations: normalizeCustomizations(requested) })
    }
    if ([...quantities.values()].some((qty) => qty > 50)) throw new Error('Maximum 50 of any item per order.')

    const points = input.useLoyaltyPoints ?? 0
    if (!Number.isInteger(points) || points < 0 || points > 100000) throw new Error('Points must be a whole number.')
    const customerPhone = input.customerPhone?.trim() ? normalizePhone(input.customerPhone) : null
    if (input.customerPhone?.trim() && !customerPhone) throw new Error('Enter a phone number with 8 to 15 digits.')
    if (points > 0 && !customerPhone) throw new Error('Look up the member phone number before redeeming points.')
    if (points > 0 && !input.paid) throw new Error('Points can only be redeemed when the order is paid now.')

    const order: LocalOrderInput = {
      lines,
      customer: input.customer,
      tableId: orderType === 'dine-in' && input.tableId && Number.isInteger(input.tableId) ? input.tableId : null,
      orderType,
      paymentMethod,
      paid: input.paid,
    }

    // Check availability locally first so the backend never charges for an order we cannot record.
    const localMenu = await loadLocalMenu([...quantities.keys()])
    const unavailable = lines.some((line) => {
      const item = localMenu.find((candidate) => candidate.id === line.menuItemId)
      return !item || item.kind !== 'menu' || !item.inStock
    })
    if (unavailable) throw new Error('One of the items is no longer available.')

    const member: MemberCheckout = customerPhone ? { customerPhone, useLoyaltyPoints: points || undefined } : {}
    const outcome = await forwardCheckout(order, localMenu, member)
    if (outcome.kind === 'rejected') return { ok: false, error: outcome.error }
    // Points live in the Java store; charging full price instead would surprise the member.
    if (outcome.kind === 'local' && points > 0) {
      return { ok: false, error: 'Redeeming points needs the Java backend, which could not price this order. Retry or remove the points.' }
    }

    const receipt = outcome.kind === 'accepted' ? outcome.receipt : undefined
    const orderCode = receipt?.orderCode ?? newLocalOrderCode()
    const res = await recordOrderLocally(
      {
        ...order,
        orderCode,
        totals: receipt ? { subtotal: receipt.subtotal, total: receipt.finalTotal } : undefined,
      },
      quantities,
    )
    refresh()
    if (!res.ok) return res
    if (!receipt) {
      // Java has not seen this order: queue it, and push it at once unless Java just failed to answer.
      await enqueueSync(orderCode)
      if (outcome.kind === 'local' && outcome.javaDown) {
        return { ok: true, message: `${res.message} Saved offline; it will be sent to the Java backend when it is back.` }
      }
      const pushed = await pushQueuedOrders([orderCode])
      return pushed.sent > 0 ? { ok: true, message: `${res.message} Order ${orderCode} synced to the Java backend.` } : res
    }
    const redeemed = receipt.pointsRedeemed > 0 ? ` Redeemed ${receipt.pointsRedeemed} points.` : ''
    const earned = receipt.pointsEarned > 0 ? ` Earned ${receipt.pointsEarned} points.` : ''
    return {
      ok: true,
      message: `Order ${receipt.orderCode} recorded by the Java backend: ${receipt.finalTotal.toLocaleString('vi-VN')} đ.${redeemed}${earned}`,
    }
  } catch (error) {
    return fail(error)
  }
}

export async function updateTableStatus(tableId: number, status: TableStatus, guestCount = 0): Promise<ActionResult> {
  try {
    assertAdminAccess()
    if (!Number.isInteger(tableId) || !tableStatuses.includes(status)) throw new Error('Invalid table update.')
    const guests = Math.min(Math.max(Math.trunc(guestCount), 0), 20)

    const remote = await updateTable(tableId, { status, guestCount: status === 'occupied' ? Math.max(guests, 1) : 0 })
    if (!remote.ok && !remote.unreachable) return { ok: false, error: remote.error }

    if (!isDbConfigured || !db) {
      const res = updateMockTableStatus(tableId, status, guests)
      refresh()
      return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'Failed' }
    }
    try {
      await db
        .update(adminTables)
        .set({
          status,
          guestCount: status === 'occupied' ? Math.max(guests, 1) : 0,
          occupiedSince: status === 'occupied' ? sql`coalesce(${adminTables.occupiedSince}, now())` : null,
          updatedAt: new Date(),
        })
        .where(eq(adminTables.id, tableId))
    } catch {
      updateMockTableStatus(tableId, status, guests)
    }
    refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

type NewReservationInput = {
  customer: string
  contact: string
  email?: string
  note?: string
  dateTime: string
  guests: number
  tableId: number
}

export async function createReservation(input: NewReservationInput): Promise<ActionResult> {
  try {
    assertAdminAccess()
    const customer = input.customer.trim().slice(0, 60)
    const contact = input.contact.trim().slice(0, 30)
    if (!customer || !contact) throw new Error('Customer name and contact are required.')
    if (!Number.isInteger(input.guests) || input.guests < 1 || input.guests > 20) {
      throw new Error('Guests must be a whole number between 1 and 20.')
    }
    if (!Number.isInteger(input.tableId)) throw new Error('Choose a table.')
    const dateTime = new Date(input.dateTime)
    if (Number.isNaN(dateTime.getTime())) throw new Error('Choose a valid date and time.')

    const booking = {
      customer,
      contact,
      email: input.email?.trim() || undefined,
      note: input.note?.trim().slice(0, 500) || undefined,
      dateTime: dateTime.toISOString(),
      guests: input.guests,
      tableId: input.tableId,
    }

    // Java runs the full validation chain (hours, capacity, availability); its verdict is final.
    const remote = await createJavaReservation(booking)
    if (remote.ok) {
      refresh()
      return { ok: true, message: `Reservation ${remote.data.id} received by the Java backend.` }
    }
    if (!remote.unreachable) return { ok: false, error: remote.error }

    const res = createMockReservation({ ...booking, email: booking.email ?? null, note: booking.note ?? null, dateTime })
    refresh()
    return res.ok ? { ok: true, message: `Reservation ${res.code} saved locally.` } : { ok: false, error: res.error ?? 'Failed' }
  } catch (error) {
    return fail(error)
  }
}

// Mirrors an order opened elsewhere (Java Adapter) into the frontend store so KDS and the floor plan show it.
async function recordExternalOrder(input: ExternalOrderInput): Promise<ActionResult> {
  if (!isDbConfigured || !db) {
    const res = createMockOrderFromItems(input)
    return res.ok ? { ok: true, message: res.message } : { ok: false, error: res.error ?? 'Failed' }
  }
  try {
    const subtotal = Math.round(input.items.reduce((sum, item) => sum + item.price * item.qty, 0) * 100) / 100
    await db.transaction(async (tx) => {
      await tx.insert(adminOrders).values({
        orderCode: input.orderCode,
        customer: input.customer.trim().slice(0, 60) || 'Walk-in',
        tableId: input.tableId,
        orderType: 'dine-in',
        items: input.items,
        subtotal,
        total: Math.round(subtotal * (1 + TAX_RATE) * 100) / 100,
        paymentMethod: 'cash',
        paymentStatus: 'unpaid',
        status: 'pending',
      })
      if (input.tableId) {
        await tx
          .update(adminTables)
          .set({
            status: 'occupied',
            guestCount: Math.max(input.guests ?? 1, 1),
            occupiedSince: sql`coalesce(${adminTables.occupiedSince}, now())`,
            updatedAt: new Date(),
          })
          .where(eq(adminTables.id, input.tableId))
      }
    })
    return { ok: true, message: `Order ${input.orderCode} opened for ${input.customer}.` }
  } catch {
    const res = createMockOrderFromItems(input)
    return res.ok ? { ok: true, message: res.message } : { ok: false, error: res.error ?? 'Failed' }
  }
}

// "Chuyển sang POS": a backend reservation goes through POST /api/reservations/{code}/transfer-pos
// (ReservationToOrderAdapter in Java); a reservation that only exists locally uses the frontend mirror.
export async function transferReservationToPos(code: string, source: 'java' | 'local', guests = 1): Promise<ActionResult> {
  try {
    assertAdminAccess()
    if (typeof code !== 'string' || !/^[A-Za-z0-9-]{1,40}$/.test(code)) throw new Error('Invalid reservation code.')

    if (source === 'local') {
      const res = transferMockReservation(code)
      refresh()
      return res.ok ? { ok: true, message: `Order ${res.orderCode} opened at the POS.` } : { ok: false, error: res.error ?? 'Failed' }
    }

    const remote = await transferJavaReservation(code)
    if (!remote.ok) {
      // The booking lives in Java, so there is nothing local to fall back to.
      return { ok: false, error: remote.unreachable ? 'Java backend is unreachable; try again shortly.' : remote.error }
    }
    const order = remote.data
    const res = await recordExternalOrder({
      orderCode: order.orderCode,
      customer: order.customer,
      tableId: order.tableId,
      items: order.items.map((item) => ({ name: item.name, qty: item.qty, price: item.price })),
      guests: Math.min(Math.max(Math.trunc(guests), 1), 20),
    })
    refresh()
    return res.ok ? { ok: true, message: `Order ${order.orderCode} opened by the Java backend.` } : res
  } catch (error) {
    return fail(error)
  }
}

// The Java id of a frontend menu item; the two stores number their menus independently.
async function javaMenuIdFor(itemId: number): Promise<number | undefined> {
  const [local] = await loadLocalMenu([itemId])
  if (!local) return undefined
  return (await resolveJavaMenuIds([local]))?.get(local.id)
}

const javaReservationStatus = {
  'Chờ xác nhận': 'pending',
  'Đã đặt': 'confirmed',
  'Đã hủy': 'cancelled',
} as const

// Status dropdown on /admin/reservations. "Hoàn thành" (seated) is reached only through
// "Sang POS", so the order and the table are always opened together with it.
export async function updateReservationStatus(
  code: string,
  source: 'java' | 'local',
  status: ReservationStatusLabel,
): Promise<ActionResult> {
  try {
    assertAdminAccess()
    if (typeof code !== 'string' || !/^[A-Za-z0-9-]{1,40}$/.test(code)) throw new Error('Invalid reservation code.')
    if (!reservationStatuses.includes(status)) throw new Error('Invalid reservation status.')
    if (status === 'Hoàn thành') throw new Error('Use "Sang POS" to seat the guests; it opens their order too.')

    if (source === 'local') {
      const res = updateMockReservationStatus(code, status)
      refresh()
      return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'Failed' }
    }
    const remote = await updateJavaReservationStatus(code, javaReservationStatus[status])
    if (!remote.ok) {
      // The booking lives in Java, so there is nothing local to fall back to.
      return { ok: false, error: remote.unreachable ? 'Java backend is unreachable; try again shortly.' : remote.error }
    }
    refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

export async function setItemInStock(itemId: number, inStock: boolean): Promise<ActionResult> {
  try {
    assertAdminAccess()
    if (!Number.isInteger(itemId)) throw new Error('Invalid item.')
    const javaId = await javaMenuIdFor(itemId)
    if (javaId !== undefined) {
      const refused = javaRefusal(await updateJavaStock(javaId, { inStock: Boolean(inStock) }))
      if (refused) return { ok: false, error: refused }
    }
    if (!isDbConfigured || !db) {
      const res = setMockItemInStock(itemId, inStock)
      refresh()
      return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'Failed' }
    }
    try {
      await db.update(adminMenuItems).set({ inStock: Boolean(inStock) }).where(eq(adminMenuItems.id, itemId))
    } catch {
      setMockItemInStock(itemId, inStock)
    }
    refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

type NewItemInput = {
  name: string
  category: string
  kind: 'menu' | 'ingredient'
  stockQty: number
  unit: string
  lowStockThreshold: number
  costPrice: number
  sellPrice: number
  recipe: string
  imageUrl: string
  variations: Variation[]
}

function money(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100000) throw new Error(`${label} must be a positive number.`)
  return Math.round(value * 100) / 100
}

export async function createMenuItem(input: NewItemInput): Promise<ActionResult> {
  try {
    assertAdminAccess()
    const name = input.name.trim().slice(0, 80)
    const category = input.category.trim().slice(0, 40)
    if (!name || !category) throw new Error('Name and category are required.')
    const imageUrl = input.imageUrl.trim()
    if (imageUrl && !/^(https:\/\/|\/)/.test(imageUrl)) throw new Error('Image must be an https URL or a site path.')
    const variations = input.variations
      .filter((option) => option.name.trim())
      .slice(0, 12)
      .map((option) => ({ name: option.name.trim().slice(0, 40), price: money(option.price, 'Option price') }))

    // POST /api/menu (MANAGER) keeps the Java catalog in step; 409 means Java already sells it.
    const remote = await createJavaMenuItem({
      name,
      category,
      kind: input.kind === 'ingredient' ? 'ingredient' : 'menu',
      sellPrice: money(input.sellPrice, 'Selling price'),
      costPrice: money(input.costPrice, 'Cost price'),
      stockQty: money(input.stockQty, 'Stock'),
      unit: input.unit.trim().slice(0, 12) || 'pcs',
      lowStockThreshold: money(input.lowStockThreshold, 'Low-stock threshold'),
      recipe: input.recipe.trim().slice(0, 1000) || undefined,
      imageUrl: imageUrl || undefined,
      variations,
    })
    if (!remote.ok && !remote.unreachable && remote.status !== 409) return { ok: false, error: remote.error }

    const localInput = {
      name,
      category,
      kind: input.kind === 'ingredient' ? ('ingredient' as const) : ('menu' as const),
      stockQty: money(input.stockQty, 'Stock'),
      unit: input.unit.trim().slice(0, 12) || 'pcs',
      lowStockThreshold: money(input.lowStockThreshold, 'Low-stock threshold'),
      costPrice: money(input.costPrice, 'Cost price'),
      sellPrice: money(input.sellPrice, 'Selling price'),
      recipe: input.recipe.trim().slice(0, 1000) || '',
      imageUrl,
      variations,
    }

    let localId: number | undefined
    if (!isDbConfigured || !db) {
      const res = createMockMenuItem(localInput)
      if (!res.ok) return { ok: false, error: res.error ?? 'Failed' }
      localId = res.id
    } else {
      try {
        const [row] = await db
          .insert(adminMenuItems)
          .values({
            ...localInput,
            inStock: input.stockQty > 0,
            recipe: localInput.recipe || null,
            imageUrl: imageUrl || null,
          })
          .returning({ id: adminMenuItems.id })
        localId = row?.id
      } catch {
        localId = createMockMenuItem(localInput).id
      }
    }
    // Created on both sides: keep the id pair so stock changes and checkouts never rely on the name.
    if (remote.ok && localId !== undefined) await linkMenuItem(localId, remote.data.id)
    refresh()
    return { ok: true, message: `${name} added.` }
  } catch (error) {
    return fail(error)
  }
}

// Local copies of the given orders: the database first, then the mock store for the rest
// (an order lands in the mock store when a database write failed).
async function loadOrdersByCode(codes: string[]): Promise<Order[]> {
  let found: Order[] = []
  if (isDbConfigured && db) {
    try {
      found = await db.select().from(adminOrders).where(inArray(adminOrders.orderCode, codes))
    } catch {
      // Fall through to the mock store.
    }
  }
  const missing = codes.filter((code) => !found.some((order) => order.orderCode === code))
  return missing.length > 0 ? [...found, ...getMockOrdersByCode(missing)] : found
}

async function loadWholeLocalMenu(): Promise<LocalMenuItem[]> {
  if (isDbConfigured && db) {
    try {
      return await db.select().from(adminMenuItems)
    } catch {
      // Fall through to the mock store.
    }
  }
  return getMockMenuItems()
}

type PushSummary = { sent: number; failed: string[]; unreachable: boolean }

// Sends queued local orders to POST /api/orders/sync (idempotent by order code) and removes
// the ones Java now has. Orders that Java refuses stay queued with the reason reported.
async function pushQueuedOrders(codes: string[]): Promise<PushSummary> {
  const summary: PushSummary = { sent: 0, failed: [], unreachable: false }
  if (codes.length === 0) return summary
  const orders = await loadOrdersByCode(codes)
  const gone = codes.filter((code) => !orders.some((order) => order.orderCode === code))
  await dequeueSync(gone) // nothing left locally to send

  const menu = await loadWholeLocalMenu()
  const javaIds = await resolveJavaMenuIds(menu)
  if (!javaIds) return { ...summary, unreachable: true }
  const localIdByName = new Map(menu.map((item) => [normalizeMenuName(item.name), item.id]))

  const payload: SyncOrderPayload[] = orders.map((order) => ({
    orderCode: order.orderCode,
    customer: order.customer,
    tableId: order.tableId,
    orderType: order.orderType,
    paymentMethod: order.paymentMethod,
    paid: order.paymentStatus === 'paid',
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    total: order.total,
    lines: order.items.map((item) => {
      const localId = localIdByName.get(normalizeMenuName(item.name))
      return {
        menuItemId: localId === undefined ? undefined : javaIds.get(localId),
        name: item.name,
        qty: item.qty,
        price: item.price,
        variation: item.variation,
      }
    }),
  }))

  for (let start = 0; start < payload.length; start += 200) {
    const result = await syncJavaOrders(payload.slice(start, start + 200))
    if (!result.ok) {
      if (result.unreachable) return { ...summary, unreachable: true }
      summary.failed.push(result.error)
      continue
    }
    const done = result.data.results
      .filter((row) => row.result !== 'failed' && row.orderCode)
      .map((row) => row.orderCode as string)
    await dequeueSync(done)
    summary.sent += done.length
    for (const row of result.data.results) {
      if (row.result === 'failed') summary.failed.push(`${row.orderCode ?? '?'}: ${row.error ?? 'rejected'}`)
    }
  }
  return summary
}

export async function syncOfflineOrders(): Promise<ActionResult> {
  try {
    assertAdminAccess()
    const queued = await listSyncQueue()
    if (queued.length === 0) return { ok: true, message: 'Nothing to sync: the Java backend has every order.' }
    const summary = await pushQueuedOrders(queued)
    refresh()
    if (summary.unreachable) return { ok: false, error: 'Java backend is unreachable; the orders stay queued.' }
    if (summary.failed.length > 0) {
      return { ok: false, error: `Synced ${summary.sent}, ${summary.failed.length} refused: ${summary.failed.slice(0, 3).join('; ')}` }
    }
    return { ok: true, message: `Synced ${summary.sent} offline order(s) to the Java backend.` }
  } catch (error) {
    return fail(error)
  }
}
