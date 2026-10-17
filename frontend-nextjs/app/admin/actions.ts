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
  type OrderItem,
  type OrderStatus,
  type TableStatus,
  type Variation,
} from '@/lib/db/schema'
import { assertAdminAccess } from '@/lib/admin/access'
import { TAX_RATE } from '@/lib/admin/format'
import { checkout, fetchMenu, type CheckoutPayload } from '@/lib/api-client'
import {
  updateMockOrderStatus,
  markMockOrderPaid,
  updateMockTableStatus,
  setMockItemInStock,
  createMockOrder,
  createMockMenuItem,
  getMockMenuItems,
  type NewMockOrderInput,
} from '@/lib/db/mock-store'

type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

function refresh() {
  revalidatePath('/admin', 'layout')
}

function fail(error: unknown): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : 'Something went wrong.' }
}

export async function updateOrderStatus(orderId: number, status: OrderStatus): Promise<ActionResult> {
  try {
    assertAdminAccess()
    if (!Number.isInteger(orderId) || !orderStatuses.includes(status)) throw new Error('Invalid order update.')
    if (!isDbConfigured || !db) {
      const res = updateMockOrderStatus(orderId, status)
      refresh()
      return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'Failed' }
    }
    try {
      await db
        .update(adminOrders)
        .set({ status, completedAt: status === 'completed' ? new Date() : null })
        .where(eq(adminOrders.id, orderId))
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

type NewOrderInput = {
  lines: { menuItemId: number; qty: number; variation?: string }[]
  customer: string
  tableId: number | null
  orderType: string
  paymentMethod: string
  paid: boolean
}

type LocalMenuItem = Pick<MenuItem, 'id' | 'name' | 'kind' | 'inStock' | 'variations'>

type CheckoutOutcome =
  | { kind: 'accepted'; orderCode: string }
  | { kind: 'local' }
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

function normalizeName(name: string) {
  return name.normalize('NFC').trim().toLowerCase()
}

// The two stores number their menus independently, so lines are matched by name.
// A line the backend cannot price (unknown item, paid variation) keeps the order local.
async function toJavaLines(lines: NewOrderInput['lines'], localMenu: LocalMenuItem[]) {
  const javaMenu = await fetchMenu()
  if (!javaMenu.ok) return null
  const javaIdByName = new Map(javaMenu.data.map((item) => [normalizeName(item.name), item.id]))
  const localById = new Map(localMenu.map((item) => [item.id, item]))

  const javaLines: CheckoutPayload['lines'] = []
  for (const line of lines) {
    const local = localById.get(line.menuItemId)
    if (!local) return null
    const variation = line.variation ? local.variations.find((option) => option.name === line.variation) : undefined
    if (variation && variation.price > 0) return null
    const javaId = javaIdByName.get(normalizeName(local.name))
    if (javaId === undefined) return null
    javaLines.push({ menuItemId: javaId, qty: line.qty })
  }
  return javaLines
}

type LocalOrderInput = NewMockOrderInput

async function forwardCheckout(order: LocalOrderInput, localMenu: LocalMenuItem[]): Promise<CheckoutOutcome> {
  // POST /api/checkout always takes payment, so open tabs stay on the local store.
  if (!order.paid) return { kind: 'local' }
  const lines = await toJavaLines(order.lines, localMenu)
  if (!lines) return { kind: 'local' }

  const receipt = await checkout({
    lines,
    customer: order.customer,
    tableId: order.tableId,
    orderType: order.orderType,
    paymentMethod: order.paymentMethod,
  })
  if (receipt.ok) return { kind: 'accepted', orderCode: receipt.data.orderCode }
  return receipt.unreachable ? { kind: 'local' } : { kind: 'rejected', error: receipt.error }
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
      return { name: item.name, qty: line.qty, price: item.sellPrice + (variation?.price ?? 0), variation: variation?.name }
    })

    const subtotal = Math.round(items.reduce((sum, item) => sum + item.price * item.qty, 0) * 100) / 100
    const total = Math.round(subtotal * (1 + TAX_RATE) * 100) / 100
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
    for (const line of input.lines) {
      if (!Number.isInteger(line.menuItemId) || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 50) {
        throw new Error('Each line needs a whole quantity between 1 and 50.')
      }
      quantities.set(line.menuItemId, (quantities.get(line.menuItemId) ?? 0) + line.qty)
    }
    if ([...quantities.values()].some((qty) => qty > 50)) throw new Error('Maximum 50 of any item per order.')

    const order: LocalOrderInput = {
      lines: input.lines,
      customer: input.customer,
      tableId: orderType === 'dine-in' && input.tableId && Number.isInteger(input.tableId) ? input.tableId : null,
      orderType,
      paymentMethod,
      paid: input.paid,
    }

    // Check availability locally first so the backend never charges for an order we cannot record.
    const localMenu = await loadLocalMenu([...quantities.keys()])
    const unavailable = input.lines.some((line) => {
      const item = localMenu.find((candidate) => candidate.id === line.menuItemId)
      return !item || item.kind !== 'menu' || !item.inStock
    })
    if (unavailable) throw new Error('One of the items is no longer available.')

    const outcome = await forwardCheckout(order, localMenu)
    if (outcome.kind === 'rejected') return { ok: false, error: outcome.error }

    const orderCode = outcome.kind === 'accepted' ? outcome.orderCode : undefined
    const res = await recordOrderLocally({ ...order, orderCode }, quantities)
    refresh()
    if (!res.ok || !orderCode) return res
    return { ok: true, message: `Order ${orderCode} recorded by the Java backend.` }
  } catch (error) {
    return fail(error)
  }
}

export async function updateTableStatus(tableId: number, status: TableStatus, guestCount = 0): Promise<ActionResult> {
  try {
    assertAdminAccess()
    if (!Number.isInteger(tableId) || !tableStatuses.includes(status)) throw new Error('Invalid table update.')
    const guests = Math.min(Math.max(Math.trunc(guestCount), 0), 20)
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

export async function setItemInStock(itemId: number, inStock: boolean): Promise<ActionResult> {
  try {
    assertAdminAccess()
    if (!Number.isInteger(itemId)) throw new Error('Invalid item.')
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

    if (!isDbConfigured || !db) {
      const res = createMockMenuItem({
        name,
        category,
        kind: input.kind === 'ingredient' ? 'ingredient' : 'menu',
        stockQty: money(input.stockQty, 'Stock'),
        unit: input.unit.trim().slice(0, 12) || 'pcs',
        lowStockThreshold: money(input.lowStockThreshold, 'Low-stock threshold'),
        costPrice: money(input.costPrice, 'Cost price'),
        sellPrice: money(input.sellPrice, 'Selling price'),
        recipe: input.recipe.trim().slice(0, 1000) || '',
        imageUrl,
        variations,
      })
      refresh()
      return res.ok ? { ok: true, message: res.message } : { ok: false, error: res.error ?? 'Failed' }
    }

    try {
      await db.insert(adminMenuItems).values({
        name,
        category,
        kind: input.kind === 'ingredient' ? 'ingredient' : 'menu',
        stockQty: money(input.stockQty, 'Stock'),
        unit: input.unit.trim().slice(0, 12) || 'pcs',
        lowStockThreshold: money(input.lowStockThreshold, 'Low-stock threshold'),
        costPrice: money(input.costPrice, 'Cost price'),
        sellPrice: money(input.sellPrice, 'Selling price'),
        inStock: input.stockQty > 0,
        recipe: input.recipe.trim().slice(0, 1000) || null,
        imageUrl: imageUrl || null,
        variations,
      })
    } catch {
      createMockMenuItem({
        name,
        category,
        kind: input.kind === 'ingredient' ? 'ingredient' : 'menu',
        stockQty: money(input.stockQty, 'Stock'),
        unit: input.unit.trim().slice(0, 12) || 'pcs',
        lowStockThreshold: money(input.lowStockThreshold, 'Low-stock threshold'),
        costPrice: money(input.costPrice, 'Cost price'),
        sellPrice: money(input.sellPrice, 'Selling price'),
        recipe: input.recipe.trim().slice(0, 1000) || '',
        imageUrl,
        variations,
      })
    }
    refresh()
    return { ok: true, message: `${name} added.` }
  } catch (error) {
    return fail(error)
  }
}
