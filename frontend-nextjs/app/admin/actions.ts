'use server'

import { eq, inArray, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { db, isDbConfigured, ensureOrderTableGroups } from '@/lib/db'
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
import { getSession } from '@/lib/auth/session'
import { TAX_RATE } from '@/lib/admin/format'
import { isDaLatAddress, shippingFee } from '@/lib/storefront/delivery'
import { withFirstOnlineOrder } from '@/lib/orders/first-online-order'
import { voucherDiscount } from '@/lib/storefront/vouchers'
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
  updateConfig,
  createUser,
  updateUser,
  type CheckoutPayload,
  type CheckoutReceipt,
  type JavaResult,
  type StoreConfigChange,
  type SyncOrderPayload,
  validateVoucher,
} from '@/lib/api-client'
import type { Cart } from '@/lib/shopify'
import { parseMenuVariant } from '@/lib/storefront/menu-catalog'
import { saveOrderContact, type Fulfilment } from '@/lib/orders/online-contacts'
import { dequeueSync, enqueueSync, listSyncQueue } from '@/lib/admin/local-links'
import { linkMenuItem, normalizeMenuName, resolveJavaMenuIds } from '@/lib/admin/menu-link'
import { hasReservationTimePassed } from '@/lib/reservation-rules'
import { getAdminBranch, ADMIN_BRANCH_COOKIE } from '@/lib/admin/branch'
import { DEFAULT_BRANCH_ID, branchById, isBranchId, type BranchId } from '@/lib/branches'
import {
  updateMockOrderStatus,
  markMockOrderPaid,
  updateMockTableStatus,
  setMockItemInStock,
  cashTenderError,
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

type LocalOrderRef = Pick<Order, 'orderCode' | 'tableId' | 'tableIds' | 'paymentMethod'>

// Code and table of a frontend order: the database first, then the mock store.
async function findLocalOrder(orderId: number): Promise<LocalOrderRef | null> {
  await ensureOrderTableGroups()
  if (isDbConfigured && db) {
    try {
      const [row] = await db
        .select({ orderCode: adminOrders.orderCode, tableId: adminOrders.tableId, tableIds: adminOrders.tableIds, paymentMethod: adminOrders.paymentMethod })
        .from(adminOrders)
        .where(eq(adminOrders.id, orderId))
      if (row) return row
    } catch {
      // Fall through to the mock store, like the writes below.
    }
  }
  const mock = getMockOrder(orderId)
  return mock ? { orderCode: mock.orderCode, tableId: mock.tableId, tableIds: mock.tableIds, paymentMethod: mock.paymentMethod } : null
}

// Java only knows the orders it priced or opened, and for those its answer is final.
// Unreachable, or 404 for an order recorded locally (e.g. while Java was down): keep it local.
function javaRefusal(result: JavaResult<unknown>): string | null {
  if (result.ok || result.unreachable || result.status === 404) return null
  return result.error
}

export async function updateOrderStatus(orderId: number, status: OrderStatus): Promise<ActionResult> {
  try {
    await assertAdminAccess()
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
          for (const tableId of local.tableIds?.length ? local.tableIds : [local.tableId]) {
            const rows = await tx.execute<{ remaining: boolean }>(sql`select exists(select 1 from admin_orders where id <> ${orderId} and status not in ('completed', 'cancelled') and (table_id = ${tableId} or table_ids @> ${JSON.stringify([tableId])}::jsonb)) as remaining`)
            if (rows.rows[0]?.remaining) continue
          await tx
            .update(adminTables)
            .set({ status: 'cleaning', guestCount: 0, occupiedSince: null, updatedAt: new Date() })
            .where(eq(adminTables.id, tableId))
          }
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
    await assertAdminAccess()
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
    await assertAdminAccess()
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
  // Optional cash handed over for a paid cash order; it must cover the total.
  tenderedAmount?: number
}

type LocalMenuItem = Pick<MenuItem, 'id' | 'name' | 'kind' | 'inStock' | 'variations' | 'sellPrice'>

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

type MemberCheckout = Pick<CheckoutPayload, 'customerPhone' | 'useLoyaltyPoints' | 'enrollMember' | 'customerEmail'>

async function forwardCheckout(
  order: LocalOrderInput,
  localMenu: LocalMenuItem[],
  member: MemberCheckout,
  extra: Pick<CheckoutPayload, 'voucherCode' | 'note'> = {},
  asService = false,
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
    tenderedAmount: order.tenderedAmount,
    branch: order.branch,
    ...member,
    ...extra,
  }, { asService })
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
  await ensureOrderTableGroups()
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
    const total = input.totals?.total ?? Math.round(subtotal * (1 + TAX_RATE) * 100) / 100 + shippingFee(input.orderType)
    const tenderError = cashTenderError(input, total)
    // Returned, not thrown: a throw here falls back to the in-memory store.
    if (tenderError) return { ok: false, error: tenderError }
    const customer = input.customer.trim().slice(0, 60) || 'Walk-in'

    await db.transaction(async (tx) => {
      const [{ next }] = await tx.execute<{ next: number }>(
        sql`select coalesce(max(id), 0) + 1 as next from admin_orders`,
      ).then((result) => result.rows)
      await tx.insert(adminOrders).values({
        orderCode: input.orderCode ?? `AC-${String(next).padStart(4, '0')}-${Date.now().toString(36).slice(-3).toUpperCase()}`,
        customer,
        tableId: input.tableId,
        branch: input.branch ?? DEFAULT_BRANCH_ID,
        orderType: input.orderType,
        items,
        subtotal,
        total,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paid ? 'paid' : 'unpaid',
        status: 'pending',
      })
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
    await assertAdminAccess()
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
    const tendered = input.tenderedAmount
    if (tendered !== undefined && (!Number.isFinite(tendered) || tendered < 0 || tendered > 1_000_000_000)) {
      throw new Error('Enter the cash received as an amount between 0 and 1,000,000,000 đ.')
    }

    const order: LocalOrderInput = {
      lines,
      customer: input.customer,
      tableId: orderType === 'dine-in' && input.tableId && Number.isInteger(input.tableId) ? input.tableId : null,
      orderType,
      paymentMethod,
      paid: input.paid,
      // Only a cash payment taken now has cash to count.
      tenderedAmount: input.paid && paymentMethod === 'cash' ? tendered : undefined,
      // The POS sells for the branch chosen in the header; its tables are the only ones it shows.
      branch: await getAdminBranch(),
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
    const change = receipt.changeDue > 0 ? ` Change due: ${receipt.changeDue.toLocaleString('vi-VN')} đ.` : ''
    const redeemed = receipt.pointsRedeemed > 0 ? ` Redeemed ${receipt.pointsRedeemed} points.` : ''
    const earned = receipt.pointsEarned > 0 ? ` Earned ${receipt.pointsEarned} points.` : ''
    return {
      ok: true,
      message: `Order ${receipt.orderCode} recorded by the Java backend: ${receipt.finalTotal.toLocaleString('vi-VN')} đ.${change}${redeemed}${earned}`,
    }
  } catch (error) {
    return fail(error)
  }
}

const CART_COOKIE = 'dalatcafe-local-cart'
const onlinePayments = { vietqr: 'qr', card: 'card', cod: 'cash' } as const

export type OnlineOrderInput = {
  name: string
  phone: string
  email?: string
  fulfilment: Fulfilment
  address?: string
  payment: keyof typeof onlinePayments
  note?: string
  // The branch that prepares the order: pickup happens there, delivery leaves from there.
  branch?: BranchId
}

export type OnlineOrderResult = { ok: true; orderCode: string; total: number; paid: boolean } | { ok: false; error: string }

function readCart(raw: string | undefined): Cart | null {
  if (!raw) return null
  try {
    const cart = JSON.parse(raw) as Cart
    return Array.isArray(cart?.lines?.nodes) ? cart : null
  } catch {
    return null
  }
}

// Cash on delivery is not charged now, so Java does not price it: the same rules apply here
// (menu price, size L surcharge, the voucher as Java validates it, VAT on what is left).
async function cashOnDeliveryTotals(lines: LocalOrderInput['lines'], localMenu: LocalMenuItem[], voucherCode?: string) {
  const byId = new Map(localMenu.map((item) => [item.id, item]))
  const raw = lines.reduce((sum, line) => sum + (byId.get(line.menuItemId)!.sellPrice + customizationSurcharge(line.customizations ?? [])) * line.qty, 0)
  const subtotal = Math.round(raw * 100) / 100
  let discount = 0
  if (voucherCode) {
    const verdict = await validateVoucher(voucherCode, subtotal)
    if (verdict.ok && verdict.data.valid) discount = verdict.data.discountAmount
    else if (!verdict.ok && verdict.unreachable) discount = voucherDiscount(subtotal, voucherCode)
    else throw new Error('Mã giảm giá không hợp lệ.')
  }
  return { subtotal, total: Math.round((subtotal - discount) * (1 + TAX_RATE) * 100) / 100 }
}

// Storefront checkout, open to guests. What is ordered and at what price comes from the
// server-side cart and the menu, never from the request. A paid order (VietQR, card) is charged
// through Java's POST /api/checkout like a POS sale; cash on delivery is recorded here and
// synced to Java. Either way the kitchen display gets the ticket.
export async function placeOnlineOrder(input: OnlineOrderInput): Promise<OnlineOrderResult> {
  try {
    const session = await getSession()
    if (!session) throw new Error('Vui lòng đăng nhập để đặt hàng.')
    const name = String(input.name ?? '').trim().slice(0, 60)
    if (name.length < 2) throw new Error('Nhập họ tên người nhận.')
    const phone = normalizePhone(input.phone)
    if (!phone) throw new Error('Nhập số điện thoại có 8 đến 15 chữ số.')
    const email = String(input.email ?? '').trim().slice(0, 120) || null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email không hợp lệ.')
    const fulfilment: Fulfilment | null = input.fulfilment === 'delivery' || input.fulfilment === 'pickup' ? input.fulfilment : null
    if (!fulfilment) throw new Error('Chọn giao hàng tận nơi hoặc tự đến lấy.')
    const address = String(input.address ?? '').trim().slice(0, 200)
    if (fulfilment === 'delivery' && address.length < 8) throw new Error('Nhập địa chỉ giao hàng.')
    if (fulfilment === 'delivery' && !isDaLatAddress(address)) {
      throw new Error('Quán chỉ giao hàng trong Đà Lạt. Địa chỉ cần có Đà Lạt, Da Lat, Dalat hoặc ĐL; ngoài khu vực vui lòng chọn tự đến lấy.')
    }
    if (!Object.hasOwn(onlinePayments, input.payment)) throw new Error('Chọn phương thức thanh toán.')
    const paymentMethod = onlinePayments[input.payment]
    const note = String(input.note ?? '').trim().slice(0, 300)
    if (input.branch !== undefined && !isBranchId(input.branch)) throw new Error('Chọn chi nhánh nhận đơn.')
    const branch = input.branch ?? DEFAULT_BRANCH_ID

    const jar = await cookies()
    const cart = readCart(jar.get(CART_COOKIE)?.value)
    const cartLines = cart?.lines.nodes ?? []
    if (cartLines.length === 0) throw new Error('Giỏ hàng đang trống.')
    if (cartLines.length > 40) throw new Error('Mỗi đơn có tối đa 40 dòng món.')

    const quantities = new Map<number, number>()
    const lines: LocalOrderInput['lines'] = []
    const lineNotes: string[] = []
    for (const line of cartLines) {
      const variant = parseMenuVariant(String(line.merchandise?.id ?? ''))
      if (!variant || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
        throw new Error('Giỏ hàng có món không còn hợp lệ, hãy thêm lại món đó.')
      }
      quantities.set(variant.menuItemId, (quantities.get(variant.menuItemId) ?? 0) + line.quantity)
      lines.push({ menuItemId: variant.menuItemId, qty: line.quantity, customizations: variant.large ? ['SIZE_L'] : [] })
      const options = (line.attributes ?? []).map((attribute) => String(attribute.value).slice(0, 40)).join(', ')
      if (options) lineNotes.push(`${String(line.merchandise.product?.title ?? '').slice(0, 80)} x${line.quantity}: ${options}`)
    }
    if ([...quantities.values()].some((qty) => qty > 50)) throw new Error('Mỗi món có tối đa 50 phần trong một đơn.')

    const localMenu = await loadLocalMenu([...quantities.keys()])
    const unavailable = lines.some((line) => {
      const item = localMenu.find((candidate) => candidate.id === line.menuItemId)
      return !item || item.kind !== 'menu' || !item.inStock
    })
    if (unavailable) throw new Error('Một món trong giỏ vừa hết, hãy cập nhật giỏ hàng.')

    return await withFirstOnlineOrder<OnlineOrderResult>(session.userId, async ({ isFirstOrder, markPlaced }) => {
      const paid = input.payment !== 'cod'
      const order: LocalOrderInput = { lines, customer: name, tableId: null, orderType: fulfilment, paymentMethod, paid, branch }
      const voucherCode = cart?.discountCodes?.find((code) => code.applicable)?.code?.trim().toUpperCase()
      if (voucherCode === 'WELCOME10' && !isFirstOrder) {
        throw new Error('WELCOME10 chỉ áp dụng cho đơn online đầu tiên của tài khoản mới.')
      }
      const javaNote = ['Đơn online', `Chi nhánh ${branchById(branch).street}`, fulfilment === 'delivery' ? `Giao tới: ${address}` : 'Khách tự đến lấy', `SĐT ${phone}`, note, ...lineNotes]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 1000)

      let receipt: CheckoutReceipt | undefined
      let totals: { subtotal: number; total: number }
      if (paid) {
        // Only money taken now earns points (cash on delivery does not): the buyer's phone becomes a member.
        const member: MemberCheckout = { customerPhone: phone, enrollMember: true, customerEmail: email ?? session.email }
        const outcome = await forwardCheckout(order, localMenu, member, { voucherCode, note: javaNote }, true)
        if (outcome.kind === 'rejected') return { ok: false, error: outcome.error }
        // Online payment is taken by Java; without it nothing may be charged or promised.
        if (outcome.kind === 'local') {
          return { ok: false, error: 'Chưa thể thanh toán trực tuyến lúc này. Hãy thử lại sau ít phút hoặc chọn thanh toán khi nhận hàng.' }
        }
        receipt = outcome.receipt
        markPlaced()
        totals = { subtotal: receipt.subtotal, total: receipt.finalTotal }
      } else {
        totals = await cashOnDeliveryTotals(lines, localMenu, voucherCode)
        totals.total += shippingFee(fulfilment)
      }

      const orderCode = receipt?.orderCode ?? newLocalOrderCode()
      const recorded = await recordOrderLocally({ ...order, orderCode, totals }, quantities)
      if (!recorded.ok) return recorded
      markPlaced()
      await saveOrderContact({
        orderCode,
        userId: session.userId,
        phone,
        email,
        address: fulfilment === 'delivery' ? address : null,
        fulfilment,
        note: [note, ...lineNotes].filter(Boolean).join(' · ') || null,
    })
    if (!receipt) {
      await enqueueSync(orderCode)
      await pushQueuedOrders([orderCode], true)
    }
    jar.delete(CART_COOKIE)
    refresh()
    return { ok: true, orderCode, total: totals.total, paid }
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Không thể đặt hàng lúc này.' }
  }
}

export async function updateTableStatus(tableId: number, status: TableStatus, guestCount = 0): Promise<ActionResult> {
  try {
    await assertAdminAccess()
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
    await assertAdminAccess()
    const customer = input.customer.trim().slice(0, 60)
    const contact = input.contact.trim().slice(0, 30)
    if (!customer || !contact) throw new Error('Customer name and contact are required.')
    // The upper limit is Java's configurable maxReservationGuests; the local fallback checks the default.
    if (!Number.isInteger(input.guests) || input.guests < 1) {
      throw new Error('Guests must be a whole number of at least 1.')
    }
    if (!Number.isInteger(input.tableId)) throw new Error('Choose a table.')
    const dateTime = new Date(input.dateTime)
    if (Number.isNaN(dateTime.getTime())) throw new Error('Choose a valid date and time.')
    // Answered before the network round trip; createMockReservation repeats it with the other Java rules.
    if (hasReservationTimePassed(dateTime)) {
      throw new Error('Choose a date and time that has not passed yet.')
    }

    const booking = {
      customer,
      contact,
      email: input.email?.trim() || undefined,
      note: input.note?.trim().slice(0, 500) || undefined,
      dateTime: dateTime.toISOString(),
      guests: input.guests,
      tableId: input.tableId,
      branch: await getAdminBranch(),
    }

    // Java runs the full validation chain (hours, capacity, availability); its verdict is final.
    const remote = await createJavaReservation(booking)
    if (remote.ok) {
      refresh()
      return { ok: true, message: `Reservation ${remote.data.id} received by the Java backend.` }
    }
    if (!remote.unreachable) return { ok: false, error: remote.error }
    // With a real database the bookings live only in Java: a local copy could not see them (double
    // booking) and would vanish on restart, so nothing is promised until Java is back.
    if (isDbConfigured) {
      return { ok: false, error: 'The reservation service is unavailable, so nothing was booked. Please retry in a moment.' }
    }

    // Demo mode without a database: the local store applies the same chain with the Java defaults.
    const res = createMockReservation({ ...booking, email: booking.email ?? null, note: booking.note ?? null, dateTime })
    refresh()
    return res.ok ? { ok: true, message: `Reservation ${res.code} saved locally.` } : { ok: false, error: res.error ?? 'Failed' }
  } catch (error) {
    return fail(error)
  }
}

// Mirrors an order opened elsewhere (Java Adapter) into the frontend store so KDS and the floor plan show it.
async function recordExternalOrder(input: ExternalOrderInput): Promise<ActionResult> {
  await ensureOrderTableGroups()
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
        tableIds: input.tableIds ?? (input.tableId ? [input.tableId] : []),
        branch: input.branch ?? DEFAULT_BRANCH_ID,
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
    await assertAdminAccess()
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
      tableIds: order.tableIds,
      items: order.items.map((item) => ({ name: item.name, qty: item.qty, price: item.price })),
      guests: Math.min(Math.max(Math.trunc(guests), 1), 20),
      branch: order.branch,
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
    await assertAdminAccess()
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
    await assertAdminAccess()
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
  unit: string
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
    await assertAdminAccess('MANAGER')
    const name = input.name.trim().slice(0, 80)
    const category = input.category.trim().slice(0, 40)
    if (!name || !category) throw new Error('Name and category are required.')
    const imageUrl = input.imageUrl.trim()
    if (imageUrl && !/^(https:\/\/|\/|data:image\/)/.test(imageUrl)) throw new Error('Image must be an https URL, a site path, or an uploaded image.')
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
      unit: input.unit.trim().slice(0, 12) || 'pcs',
      recipe: input.recipe.trim().slice(0, 1000) || undefined,
      imageUrl: imageUrl || undefined,
      variations,
    })
    if (!remote.ok && !remote.unreachable && remote.status !== 409) return { ok: false, error: remote.error }

    const localInput = {
      name,
      category,
      kind: input.kind === 'ingredient' ? ('ingredient' as const) : ('menu' as const),
      unit: input.unit.trim().slice(0, 12) || 'pcs',
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
            inStock: true,
            recipe: localInput.recipe || null,
            imageUrl: imageUrl || null,
          })
          .returning({ id: adminMenuItems.id })
        localId = row?.id
      } catch {
        localId = createMockMenuItem(localInput).id
      }
    }
    // Created on both sides: keep the id pair so on/off switches and checkouts never rely on the name.
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
  await ensureOrderTableGroups()
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
async function pushQueuedOrders(codes: string[], asService = false): Promise<PushSummary> {
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
    tableIds: order.tableIds,
    orderType: order.orderType,
    branch: order.branch,
    paymentMethod: order.paymentMethod,
    paid: order.paymentStatus === 'paid',
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    completedAt: order.completedAt ? order.completedAt.toISOString() : null,
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
    const result = await syncJavaOrders(payload.slice(start, start + 200), { asService })
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
    await assertAdminAccess()
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

// Store settings live in the Java SystemConfigManager Singleton, so there is no local fallback.
export async function updateStoreSettings(change: StoreConfigChange): Promise<ActionResult> {
  try {
    await assertAdminAccess('ADMIN')
    const remote = await updateConfig(change)
    if (!remote.ok) {
      return { ok: false, error: remote.unreachable ? 'Java backend is unreachable; settings were not changed.' : remote.error }
    }
    refresh()
    return { ok: true, message: 'Settings saved on the Java backend.' }
  } catch (error) {
    return fail(error)
  }
}

const accountRoles = ['CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN'] as const

// Accounts live in the Java backend (/api/users, ADMIN); there is no local fallback.
function accountError(result: Extract<JavaResult<unknown>, { ok: false }>) {
  if (result.unreachable) return 'Java backend is unreachable; accounts were not changed.'
  return result.code === 'EMAIL_TAKEN' ? 'An account with this email already exists.' : result.error
}

export async function createAccount(input: { email: string; name: string; password: string; role: string }): Promise<ActionResult> {
  try {
    await assertAdminAccess('ADMIN')
    const role = accountRoles.find((candidate) => candidate === input.role)
    if (!role) throw new Error('Choose a valid role.')
    const result = await createUser({ email: input.email.trim(), name: input.name.trim(), password: input.password, role })
    if (!result.ok) return { ok: false, error: accountError(result) }
    refresh()
    return { ok: true, message: `Account ${result.data.email} created as ${role}.` }
  } catch (error) {
    return fail(error)
  }
}

export async function updateAccount(id: number, change: { role?: string; active?: boolean }): Promise<ActionResult> {
  try {
    await assertAdminAccess('ADMIN')
    if (!Number.isInteger(id)) throw new Error('Invalid account.')
    const role = change.role === undefined ? undefined : accountRoles.find((candidate) => candidate === change.role)
    if (change.role !== undefined && !role) throw new Error('Choose a valid role.')
    const result = await updateUser(id, { role, active: change.active })
    if (!result.ok) return { ok: false, error: accountError(result) }
    refresh()
    return { ok: true, message: `Account ${result.data.email} updated.` }
  } catch (error) {
    return fail(error)
  }
}

// Header branch switch: every admin page, the POS and the reports follow the chosen branch.
export async function selectAdminBranch(branch: string): Promise<ActionResult> {
  try {
    await assertAdminAccess()
    if (!isBranchId(branch)) throw new Error('Chi nhánh không hợp lệ.')
    ;(await cookies()).set(ADMIN_BRANCH_COOKIE, branch, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    refresh()
    return { ok: true, message: `Đang xem chi nhánh ${branchById(branch).street}.` }
  } catch (error) {
    return fail(error)
  }
}
