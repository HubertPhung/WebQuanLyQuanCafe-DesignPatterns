'use server'

import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { db, isDbConfigured, ensureOrderTableGroups, ensureOrderCancellation, ensureMenuImageStorage } from '@/lib/db'
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
import { orderTransitionError } from '@/lib/orders/lifecycle'
import { localImageSrc } from '@/lib/assets'
import { assertPosTableAvailable, withPosTableLock } from '@/lib/admin/pos-table-guard'
import { isDaLatAddress, shippingFee } from '@/lib/storefront/delivery'
import { withFirstOnlineOrder } from '@/lib/orders/first-online-order'
import {
  customizationSurcharge,
  describeCustomizations,
  isPosCustomization,
  normalizeCustomizations,
} from '@/lib/admin/customizations'
import {
  checkout,
  createJavaMenuItem,
  updateJavaMenuItem,
  deleteJavaMenuItem,
  createReservation as createJavaReservation,
  findCustomerByPhone,
  fetchMenu,
  getJavaBackendUrl,
  payJavaOrder,
  transferReservation as transferJavaReservation,
  updateJavaOrderStatus,
  updateJavaReservationStatus,
  updateJavaReservation,
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
  redeemVoucher,
  releaseVoucher,
} from '@/lib/api-client'
import type { Cart } from '@/lib/shopify'
import { parseMenuVariant } from '@/lib/storefront/menu-catalog'
import { saveOrderContact, type Fulfilment } from '@/lib/orders/online-contacts'
import { dequeueSync, enqueueSync, listSyncQueue } from '@/lib/admin/local-links'
import { normalizeMenuName, resolveJavaMenuIds } from '@/lib/admin/menu-link'
import { deleteMenuItemRecord, persistMenuItem, updateMenuItemRecord, type MenuCatalogInput } from '@/lib/admin/menu-store'
import { hasReservationTimePassed, reservationRangeError } from '@/lib/reservation-rules'
import { getAdminBranch, ADMIN_BRANCH_COOKIE } from '@/lib/admin/branch'
import { DEFAULT_BRANCH_ID, branchById, isBranchId, type BranchId } from '@/lib/branches'
import {
  updateMockOrderStatus,
  markMockOrderPaid,
  updateMockTableStatus,
  setMockItemInStock,
  cashTenderError,
  createMockOrder,
  getMockMenuItems,
  createMockReservation,
  createMockOrderFromItems,
  getMockOrder,
  getMockOrdersByCode,
  updateMockReservationStatus,
  updateMockReservation,
  reservationStatuses,
  type ReservationStatusLabel,
  transferMockReservation,
  type ExternalOrderInput,
  type NewMockOrderInput,
} from '@/lib/db/mock-store'

type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

function refresh() {
  revalidatePath('/admin', 'layout')
  revalidatePath('/account/orders')
}

function refreshMenu() {
  refresh()
  revalidatePath('/')
}

function fail(error: unknown): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : 'Something went wrong.' }
}

type LocalOrderRef = Pick<Order, 'orderCode' | 'tableId' | 'tableIds' | 'paymentMethod' | 'status' | 'paymentStatus'>

// Chỉ tìm id trong kho đang cấu hình; id của mock có thể trỏ tới đơn không liên quan.
async function findLocalOrder(orderId: number): Promise<LocalOrderRef | null> {
  await ensureOrderTableGroups()
  if (isDbConfigured && db) {
    const [row] = await db
      .select({ orderCode: adminOrders.orderCode, tableId: adminOrders.tableId, tableIds: adminOrders.tableIds, paymentMethod: adminOrders.paymentMethod, status: adminOrders.status, paymentStatus: adminOrders.paymentStatus })
      .from(adminOrders)
      .where(eq(adminOrders.id, orderId))
    return row ?? null
  }
  const mock = getMockOrder(orderId)
  return mock ?? null
}

// Java chỉ biết những đơn nó đã tính tiền hoặc mở, và với các đơn đó câu trả lời của nó là cuối
// cùng. Không kết nối được, hoặc 404 với đơn ghi cục bộ (ví dụ lúc Java ngừng hoạt động): giữ ở cục
// bộ.
function javaRefusal(result: JavaResult<unknown>): string | null {
  if (result.ok || result.unreachable || result.status === 404) return null
  return result.error
}

export async function updateOrderStatus(orderId: number, status: OrderStatus): Promise<ActionResult> {
  try {
    await assertAdminAccess()
    if (!Number.isInteger(orderId) || !orderStatuses.includes(status)) throw new Error('Trạng thái đơn không hợp lệ.')
    // Nâng cấp database trước khi đổi bên Java, để ràng buộc CHECK cũ không làm hai kho lệch nhau.
    await ensureOrderCancellation()
    const local = await findLocalOrder(orderId)
    if (!local) return { ok: false, error: 'Không tìm thấy đơn hàng.' }
    const invalid = orderTransitionError(local, status)
    if (invalid) return { ok: false, error: invalid }
    let remoteRefunded = false
    if (local) {
      const remote = await updateJavaOrderStatus(local.orderCode, status)
      if (status === 'cancelled' && getJavaBackendUrl() && !remote.ok && remote.unreachable) return { ok: false, error: 'Không kết nối được máy chủ để hủy đơn. Vui lòng thử lại.' }
      const refused = javaRefusal(remote)
      if (refused) return { ok: false, error: refused }
      remoteRefunded = remote.ok && remote.data.paymentStatus === 'refunded'
    }
    if (!isDbConfigured || !db) {
      if (remoteRefunded) {
        const mock = getMockOrder(orderId)
        if (mock) mock.paymentStatus = 'refunded'
      }
      const res = updateMockOrderStatus(orderId, status)
      refresh()
      return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'Failed' }
    }
    try {
      const saved = await db.transaction(async (tx) => {
        const changed = await tx
          .update(adminOrders)
          .set({ status, completedAt: status === 'completed' ? new Date() : null,
            ...(status === 'cancelled' ? { paymentStatus: remoteRefunded ? 'refunded' as const : sql`case when ${adminOrders.paymentStatus} = 'paid' then 'refunded' else ${adminOrders.paymentStatus} end` } : {}),
          })
          .where(and(eq(adminOrders.id, orderId), sql`(${adminOrders.status} not in ('completed', 'cancelled') or ${adminOrders.status} = ${status})`))
          .returning({ id: adminOrders.id })
        if (!changed.length) return false
        // Bản sao của TableStatusSyncObserver bên Java: đơn ăn tại chỗ hoàn tất thì bàn chuyển sang
        // dọn dẹp.
        if ((status === 'completed' || status === 'cancelled') && local?.tableId) {
          for (const tableId of local.tableIds?.length ? local.tableIds : [local.tableId]) {
            const rows = await tx.execute<{ remaining: boolean }>(sql`select exists(select 1 from admin_orders where id <> ${orderId} and status not in ('completed', 'cancelled') and (table_id = ${tableId} or table_ids @> ${JSON.stringify([tableId])}::jsonb)) as remaining`)
            if (rows.rows[0]?.remaining) continue
            await tx
              .update(adminTables)
              .set({ status: 'cleaning', guestCount: 0, occupiedSince: null, updatedAt: new Date() })
              .where(eq(adminTables.id, tableId))
          }
        }
        return true
      })
      if (!saved) return { ok: false, error: 'Đơn vừa kết thúc hoặc bị hủy. Vui lòng tải lại.' }
    } catch (error) {
      console.error('Could not persist order status:', error)
      refresh()
      return { ok: false, error: 'Chưa lưu được trạng thái đơn. Vui lòng thử lại để đồng bộ.' }
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
    if (local?.status === 'cancelled' || local?.paymentStatus === 'refunded') return { ok: false, error: 'Không thể thu tiền đơn đã hủy.' }
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
      const saved = await db.update(adminOrders).set({ paymentStatus: 'paid' })
        .where(and(eq(adminOrders.id, orderId), ne(adminOrders.status, 'cancelled'), ne(adminOrders.paymentStatus, 'refunded')))
        .returning({ id: adminOrders.id })
      if (!saved.length) return { ok: false, error: 'Đơn vừa bị hủy. Vui lòng tải lại và đối soát thanh toán.' }
    } catch {
      markMockOrderPaid(orderId)
    }
    refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

// Chỉ giữ chữ số, giống cách kho khách hàng Java lưu số điện thoại ("0908 123 456" ->
// "0908123456").
function normalizePhone(raw: string | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15 ? digits : null
}

export type Member = { name: string; phone: string; points: number; rank: string }
export type MemberLookup = { ok: true; member: Member | null; offline: boolean } | { ok: false; error: string }

// Tra cứu thành viên ở POS qua GET /api/customers?phone=... (thành viên nằm ở kho Java).
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
  // Số điện thoại thành viên và số điểm muốn đổi; đổi điểm cần backend Java.
  customerPhone?: string
  useLoyaltyPoints?: number
  // Tiền mặt khách đưa (tùy chọn) cho đơn tiền mặt đã thanh toán; phải đủ tổng tiền.
  tenderedAmount?: number
}

type LocalMenuItem = Pick<MenuItem, 'id' | 'name' | 'kind' | 'inStock' | 'variations' | 'sellPrice'>

type CheckoutOutcome =
  | { kind: 'accepted'; receipt: CheckoutReceipt }
  // javaDown: Java không phản hồi, nên đẩy bản cục bộ ngay lúc này là vô ích.
  | { kind: 'local'; javaDown: boolean }
  | { kind: 'rejected'; error: string }

async function loadLocalMenu(ids: number[]): Promise<LocalMenuItem[]> {
  if (isDbConfigured && db) {
    try {
      return await db.select().from(adminMenuItems).where(inArray(adminMenuItems.id, ids))
    } catch {
      // Cùng cách xử lý như các thao tác ghi bên dưới: database không kết nối được thì dùng mock
      // store.
    }
  }
  return getMockMenuItems().filter((item) => ids.includes(item.id))
}

// Hai kho đánh số món độc lập; menu-link giữ các cặp id. Dòng mà backend không tính giá được (món
// lạ, biến thể có phụ thu) khiến đơn được giữ ở cục bộ. Size L và topping được gửi thành
// customization của Java và tính giá bởi các Decorator ở đó.
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
  extra: Pick<CheckoutPayload, 'voucherCode' | 'note' | 'userId'> = {},
  asService = false,
): Promise<CheckoutOutcome> {
  // POST /api/checkout luôn thu tiền, nên hóa đơn mở (chưa trả) được ghi cục bộ rồi đồng bộ sau.
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

// Mã đơn do frontend tự cấp; đơn do Java tính giá giữ mã mà Java trả về.
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

    // Hóa đơn của Java được ưu tiên khi Java tính giá đơn (giảm giá thành viên, đổi điểm).
    const subtotal = input.totals?.subtotal ?? Math.round(items.reduce((sum, item) => sum + item.price * item.qty, 0) * 100) / 100
    const total = input.totals?.total ?? Math.round(subtotal * (1 + TAX_RATE) * 100) / 100 + shippingFee(input.orderType)
    const tenderError = cashTenderError(input, total)
    // Trả về chứ không ném lỗi: ném ở đây sẽ rơi sang kho trong bộ nhớ.
    if (tenderError) return { ok: false, error: tenderError }
    const customer = input.customer.trim().slice(0, 60) || 'Walk-in'

    await db.transaction(async (tx) => {
      if (input.tableId) {
        const [table] = await tx.select({ id: adminTables.id }).from(adminTables).where(eq(adminTables.id, input.tableId)).for('update')
        if (!table) throw new Error('Bàn không còn phục vụ.')
        const open = await tx.execute<{ busy: boolean }>(sql`select exists(select 1 from admin_orders where (table_id = ${input.tableId} or table_ids @> ${JSON.stringify([input.tableId])}::jsonb) and status <> 'cancelled' and (status <> 'completed' or payment_status = 'unpaid')) as busy`)
        if (open.rows[0]?.busy) throw new Error('Bàn đã có đơn đang phục vụ. Vui lòng chọn bàn khác.')
      }
      const [{ next }] = await tx.execute<{ next: number }>(
        sql`select coalesce(max(id), 0) + 1 as next from admin_orders`,
      ).then((result) => result.rows)
      await tx.insert(adminOrders).values({
        orderCode: input.orderCode ?? `AC-${String(next).padStart(4, '0')}-${Date.now().toString(36).slice(-3).toUpperCase()}`,
        customer,
        tableId: input.tableId,
        tableIds: input.tableId ? [input.tableId] : [],
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
          .set({ status: 'occupied', guestCount: sql`greatest(${adminTables.guestCount}, 1)`, occupiedSince: sql`coalesce(${adminTables.occupiedSince}, now())`, updatedAt: new Date() })
          .where(eq(adminTables.id, input.tableId))
      }
    })
    return { ok: true, message: `Order sent to the bar for ${customer}.` }
  } catch (error) {
    console.error('Could not record order:', error)
    return { ok: false, error: 'Không lưu được đơn hàng. Vui lòng kiểm tra lại trạng thái bàn và thử lại.' }
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
      // Chỉ thanh toán tiền mặt ngay lúc này mới có tiền mặt để đếm.
      tenderedAmount: input.paid && paymentMethod === 'cash' ? tendered : undefined,
      // POS bán cho chi nhánh đang chọn ở header; nó chỉ hiện bàn của chi nhánh đó.
      branch: await getAdminBranch(),
    }

    return await withPosTableLock(order.tableId, async () => {
      await assertPosTableAvailable(order.tableId, order.branch ?? DEFAULT_BRANCH_ID)
      // Kiểm tra món còn bán ở cục bộ trước, để backend không bao giờ thu tiền cho đơn mà ta không
      // ghi lại được.
      const localMenu = await loadLocalMenu([...quantities.keys()])
      const unavailable = lines.some((line) => {
        const item = localMenu.find((candidate) => candidate.id === line.menuItemId)
        return !item || item.kind !== 'menu' || !item.inStock
      })
      if (unavailable) throw new Error('One of the items is no longer available.')

      const member: MemberCheckout = customerPhone ? { customerPhone, useLoyaltyPoints: points || undefined } : {}
      const outcome = await forwardCheckout(order, localMenu, member)
      if (outcome.kind === 'rejected') return { ok: false, error: outcome.error }
      // Điểm nằm ở kho Java; thu đủ tiền thay vì đổi điểm sẽ khiến thành viên bất ngờ.
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
        // Java chưa thấy đơn này: đưa vào hàng đợi, và đẩy ngay trừ khi Java vừa không phản hồi.
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
    })
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
  // Chi nhánh làm đơn: khách đến lấy tại đó, giao hàng xuất phát từ đó.
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

// Tiền mặt khi nhận hàng chưa thu lúc này, nên Java không tính giá đơn: các quy tắc giống hệt được
// áp dụng ở đây (giá thực đơn, phụ thu size L, VAT trên phần còn lại). Mức giảm của voucher là số
// Java trả về khi giữ lượt cho đơn.
function cashOnDeliverySubtotal(lines: LocalOrderInput['lines'], localMenu: LocalMenuItem[]): number {
  const byId = new Map(localMenu.map((item) => [item.id, item]))
  const raw = lines.reduce((sum, line) => sum + (byId.get(line.menuItemId)!.sellPrice + customizationSurcharge(line.customizations ?? [])) * line.qty, 0)
  return Math.round(raw * 100) / 100
}

function cashOnDeliveryTotals(subtotal: number, discount: number) {
  return { subtotal, total: Math.round((subtotal - discount) * (1 + TAX_RATE) * 100) / 100 }
}

// Checkout của storefront, mở cho khách vãng lai. Món gì và giá bao nhiêu lấy từ giỏ hàng phía
// server và thực đơn, không bao giờ lấy từ request. Đơn trả trước (VietQR, thẻ) được thu tiền qua
// POST /api/checkout của Java như một lượt bán ở POS; tiền mặt khi nhận hàng được ghi ở đây rồi
// đồng bộ sang Java. Cả hai cách thì màn hình pha chế đều nhận được phiếu.
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
      const voucherCode = cart?.discountCodes?.find((code) => code.applicable)?.code?.trim().toUpperCase() || undefined
      const subtotal = cashOnDeliverySubtotal(lines, localMenu)
      if (voucherCode) {
        // Java quyết định mã còn dùng được không; không hỏi được thì không hứa giảm giá.
        const verdict = await validateVoucher(voucherCode, subtotal, session.userId)
        if (!verdict.ok) return { ok: false, error: 'Tạm thời chưa áp dụng được mã giảm giá. Hãy thử lại hoặc bỏ mã.' }
        if (!verdict.data.valid) return { ok: false, error: verdict.data.description }
        if (verdict.data.firstOnlineOrderOnly && !isFirstOrder) {
          throw new Error(`${voucherCode} chỉ áp dụng cho đơn online đầu tiên của tài khoản.`)
        }
      }
      const javaNote = ['Đơn online', `Chi nhánh ${branchById(branch).street}`, fulfilment === 'delivery' ? `Giao tới: ${address}` : 'Khách tự đến lấy', `SĐT ${phone}`, note, ...lineNotes]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 1000)

      let receipt: CheckoutReceipt | undefined
      // Đơn trả trước lấy tổng tiền Java đã thu; đơn COD tính ở dưới, sau khi giữ lượt voucher.
      let totals!: { subtotal: number; total: number }
      if (paid) {
        // Chỉ tiền thu ngay mới được cộng điểm (tiền mặt khi nhận hàng thì không): số điện thoại
        // người mua trở thành thành viên.
        const member: MemberCheckout = { customerPhone: phone, enrollMember: true, customerEmail: email ?? session.email }
        const outcome = await forwardCheckout(order, localMenu, member, { voucherCode, note: javaNote, userId: session.userId }, true)
        if (outcome.kind === 'rejected') return { ok: false, error: outcome.error }
        // Thanh toán online do Java thu; không có Java thì không được thu tiền hay hứa hẹn gì.
        if (outcome.kind === 'local') {
          return { ok: false, error: 'Chưa thể thanh toán trực tuyến lúc này. Hãy thử lại sau ít phút hoặc chọn thanh toán khi nhận hàng.' }
        }
        receipt = outcome.receipt
        markPlaced()
        totals = { subtotal: receipt.subtotal, total: receipt.finalTotal }
      }

      const orderCode = receipt?.orderCode ?? newLocalOrderCode()
      let redeemed = false
      if (!receipt) {
        // Đơn COD giữ lượt voucher ngay lúc đặt; Java ghi lượt theo mã đơn và dùng đúng mức giảm
        // này khi đơn được đồng bộ sang.
        let discount = 0
        if (voucherCode) {
          const redemption = await redeemVoucher({ code: voucherCode, subtotal, userId: session.userId, orderCode })
          if (!redemption.ok) {
            return { ok: false, error: redemption.unreachable ? 'Tạm thời chưa áp dụng được mã giảm giá. Hãy thử lại hoặc bỏ mã.' : redemption.error }
          }
          discount = redemption.data.discountAmount
          redeemed = true
        }
        totals = cashOnDeliveryTotals(subtotal, discount)
        totals.total += shippingFee(fulfilment)
      }
      const recorded = await recordOrderLocally({ ...order, orderCode, totals }, quantities)
      if (!recorded.ok) {
        if (redeemed) await releaseVoucher(orderCode)
        return recorded
      }
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
  // Giờ kết thúc (ISO-8601); không gửi thì Java giữ bàn hai giờ, hoặc giữ thời lượng cũ khi sửa.
  endTime?: string
  guests: number
  tableId: number
  // Phiếu ghép nhiều bàn; khi đó tableId là bàn đầu tiên.
  tableIds?: number[]
}

// Giờ kết thúc nếu có gửi, kiểm tra cùng quy tắc với OperatingHoursValidator bên Java.
function bookingEnd(input: NewReservationInput, dateTime: Date): Date | undefined {
  if (!input.endTime) return undefined
  const endTime = new Date(input.endTime)
  const error = reservationRangeError(dateTime, endTime)
  if (error) throw new Error(error)
  return endTime
}

// Dùng chung cho tạo và sửa phiếu đặt bàn ở trang admin.
function bookingFields(input: NewReservationInput) {
  const customer = input.customer.trim().slice(0, 60)
  const contact = input.contact.trim().slice(0, 30)
  if (!customer || !contact) throw new Error('Nhập tên khách và số điện thoại.')
  if (!Number.isInteger(input.guests) || input.guests < 1) throw new Error('Số khách phải là số nguyên từ 1 trở lên.')
  const tableIds = input.tableIds?.length ? input.tableIds : [input.tableId]
  if (tableIds.length > 10 || new Set(tableIds).size !== tableIds.length || tableIds.some(id => !Number.isInteger(id) || id < 1)) {
    throw new Error('Chọn bàn hợp lệ.')
  }
  const dateTime = new Date(input.dateTime)
  if (Number.isNaN(dateTime.getTime())) throw new Error('Chọn ngày giờ hợp lệ.')
  if (hasReservationTimePassed(dateTime)) throw new Error('Chọn ngày giờ chưa qua.')
  return {
    customer,
    contact,
    email: input.email?.trim() || undefined,
    note: input.note?.trim().slice(0, 500) || undefined,
    dateTime,
    endTime: bookingEnd(input, dateTime),
    guests: input.guests,
    tableId: tableIds[0],
    tableIds,
  }
}

// "Sửa phiếu" ở /admin/reservations: phiếu bên Java đi qua PUT /api/reservations/{code}, vốn chạy
// lại toàn bộ chuỗi kiểm tra; phiếu cục bộ đi qua cùng các quy tắc trong mock store.
export async function updateReservation(code: string, source: 'java' | 'local', input: NewReservationInput): Promise<ActionResult> {
  try {
    await assertAdminAccess()
    if (typeof code !== 'string' || !/^[A-Za-z0-9-]{1,40}$/.test(code)) throw new Error('Mã phiếu không hợp lệ.')
    const booking = bookingFields(input)
    if (source === 'local') {
      const res = updateMockReservation(code, { ...booking, email: booking.email ?? null, note: booking.note ?? null })
      refresh()
      return res.ok ? { ok: true, message: `Đã lưu phiếu ${code}.` } : { ok: false, error: res.error ?? 'Không lưu được phiếu.' }
    }
    const remote = await updateJavaReservation(code, { ...booking, dateTime: booking.dateTime.toISOString(), endTime: booking.endTime?.toISOString() })
    if (!remote.ok) {
      return { ok: false, error: remote.unreachable ? 'Backend Java chưa phản hồi, phiếu chưa thay đổi. Vui lòng thử lại.' : remote.error }
    }
    refresh()
    return { ok: true, message: `Đã lưu phiếu ${code}.` }
  } catch (error) {
    return fail(error)
  }
}

export async function createReservation(input: NewReservationInput): Promise<ActionResult> {
  try {
    await assertAdminAccess()
    const customer = input.customer.trim().slice(0, 60)
    const contact = input.contact.trim().slice(0, 30)
    if (!customer || !contact) throw new Error('Customer name and contact are required.')
    // Giới hạn trên là maxReservationGuests cấu hình được bên Java; bản dự phòng cục bộ kiểm tra
    // theo giá trị mặc định.
    if (!Number.isInteger(input.guests) || input.guests < 1) {
      throw new Error('Guests must be a whole number of at least 1.')
    }
    if (!Number.isInteger(input.tableId)) throw new Error('Choose a table.')
    const dateTime = new Date(input.dateTime)
    if (Number.isNaN(dateTime.getTime())) throw new Error('Choose a valid date and time.')
    // Trả lời trước khi gọi mạng; createMockReservation kiểm tra lại cùng các quy tắc khác của
    // Java.
    if (hasReservationTimePassed(dateTime)) {
      throw new Error('Choose a date and time that has not passed yet.')
    }
    const endTime = bookingEnd(input, dateTime)

    const booking = {
      customer,
      contact,
      email: input.email?.trim() || undefined,
      note: input.note?.trim().slice(0, 500) || undefined,
      dateTime: dateTime.toISOString(),
      endTime: endTime?.toISOString(),
      guests: input.guests,
      tableId: input.tableId,
      branch: await getAdminBranch(),
    }

    // Java chạy đủ chuỗi kiểm tra (giờ mở cửa, sức chứa, bàn trống); kết luận của nó là cuối cùng.
    const remote = await createJavaReservation(booking)
    if (remote.ok) {
      refresh()
      return { ok: true, message: `Reservation ${remote.data.id} received by the Java backend.` }
    }
    if (!remote.unreachable) return { ok: false, error: remote.error }
    // Khi có database thật, phiếu đặt chỉ nằm ở Java: bản sao cục bộ không thấy được chúng (đặt
    // trùng) và sẽ mất khi khởi động lại, nên không hứa gì cho tới khi Java hoạt động lại.
    if (isDbConfigured || getJavaBackendUrl()) {
      return { ok: false, error: 'Chưa kiểm tra được lịch bàn do mất kết nối. Chưa ghi nhận đặt bàn, vui lòng thử lại.' }
    }

    // Chế độ demo không có database: kho cục bộ áp cùng chuỗi kiểm tra với mặc định của Java.
    const res = createMockReservation({ ...booking, email: booking.email ?? null, note: booking.note ?? null, dateTime, endTime: endTime ?? null })
    refresh()
    return res.ok ? { ok: true, message: `Reservation ${res.code} saved locally.` } : { ok: false, error: res.error ?? 'Failed' }
  } catch (error) {
    return fail(error)
  }
}

// Chép một đơn được mở ở nơi khác (Adapter bên Java) vào kho frontend để KDS và sơ đồ bàn hiển thị
// nó.
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

// "Chuyển sang POS": phiếu ở backend đi qua POST /api/reservations/{code}/transfer-pos
// (ReservationToOrderAdapter bên Java); phiếu chỉ có ở cục bộ dùng bản sao phía frontend.
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
      // Phiếu đặt nằm ở Java, nên không có gì cục bộ để dự phòng.
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

// Id bên Java của một món frontend; hai kho đánh số món độc lập.
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

// Ô chọn trạng thái ở /admin/reservations. "Hoàn thành" (đã nhận bàn) chỉ đạt được qua "Sang POS",
// nên đơn và bàn luôn được mở cùng lúc với nó.
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
      // Phiếu đặt nằm ở Java, nên không có gì cục bộ để dự phòng.
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
      refreshMenu()
      return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'Failed' }
    }
    try {
      const updated = await db.update(adminMenuItems).set({ inStock: Boolean(inStock) }).where(eq(adminMenuItems.id, itemId)).returning({ id: adminMenuItems.id })
      if (updated.length === 0) return { ok: false, error: 'Không tìm thấy món trong thực đơn.' }
    } catch {
      return { ok: false, error: 'Chưa lưu được trạng thái bán của món. Vui lòng thử lại.' }
    }
    refreshMenu()
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

// Prices are in VND: a drink can cost well over 100.000đ.
function money(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100_000_000) throw new Error(`${label} phải là số từ 0 đến 100.000.000.`)
  return Math.round(value * 100) / 100
}

// Các trường thực đơn đã kiểm tra, dùng chung cho tạo và sửa món.
function catalogFields(input: NewItemInput): MenuCatalogInput {
  const name = input.name.trim().slice(0, 80)
  const category = input.category.trim().slice(0, 40)
  if (!name || !category) throw new Error('Vui lòng nhập tên món và danh mục.')
  const imageUrl = localImageSrc(input.imageUrl, '')
  if (input.imageUrl.trim() && !imageUrl) throw new Error('Vui lòng tải ảnh lên hoặc chọn ảnh có sẵn trong trang.')
  return {
    name,
    category,
    kind: input.kind === 'ingredient' ? 'ingredient' : 'menu',
    unit: input.unit.trim().slice(0, 12) || 'pcs',
    costPrice: money(input.costPrice, 'Giá vốn'),
    sellPrice: money(input.sellPrice, 'Giá bán'),
    recipe: input.recipe.trim().slice(0, 1000),
    imageUrl,
    variations: input.variations.filter(option => option.name.trim()).slice(0, 12)
      .map(option => ({ name: option.name.trim().slice(0, 40), price: money(option.price, 'Giá tùy chọn') })),
  }
}

// Java tính giá đơn POS, nên thao tác sửa hay xóa phải tới Java trước. Khi không cấu hình backend
// Java (chế độ demo) thì chỉ thực đơn cục bộ thay đổi.
async function javaCatalogRefusal(result: JavaResult<unknown>): Promise<string | null> {
  if (result.ok) return null
  if (result.unreachable) return getJavaBackendUrl() ? 'Backend Java chưa phản hồi, thực đơn chưa thay đổi. Vui lòng thử lại.' : null
  return result.status === 404 ? null : result.error
}

export async function updateMenuItem(itemId: number, input: NewItemInput): Promise<ActionResult> {
  try {
    await assertAdminAccess('MANAGER')
    if (!Number.isInteger(itemId) || itemId < 1) throw new Error('Món không hợp lệ.')
    const fields = catalogFields(input)
    await ensureMenuImageStorage()
    const javaId = await javaMenuIdFor(itemId)
    if (javaId !== undefined) {
      const refused = await javaCatalogRefusal(await updateJavaMenuItem(javaId, fields))
      if (refused) return { ok: false, error: refused }
    } else if (getJavaBackendUrl() && !(await fetchMenu()).ok) {
      return { ok: false, error: 'Backend Java chưa phản hồi, thực đơn chưa thay đổi. Vui lòng thử lại.' }
    }
    await updateMenuItemRecord(itemId, fields)
    refreshMenu()
    return { ok: true, message: `Đã lưu thay đổi của ${fields.name}.` }
  } catch (error) {
    return fail(error)
  }
}

export async function deleteMenuItem(itemId: number): Promise<ActionResult> {
  try {
    await assertAdminAccess('MANAGER')
    if (!Number.isInteger(itemId) || itemId < 1) throw new Error('Món không hợp lệ.')
    const javaId = await javaMenuIdFor(itemId)
    if (javaId !== undefined) {
      const refused = await javaCatalogRefusal(await deleteJavaMenuItem(javaId))
      if (refused) return { ok: false, error: refused }
    } else if (getJavaBackendUrl() && !(await fetchMenu()).ok) {
      return { ok: false, error: 'Backend Java chưa phản hồi, thực đơn chưa thay đổi. Vui lòng thử lại.' }
    }
    await deleteMenuItemRecord(itemId)
    refreshMenu()
    return { ok: true, message: 'Đã xoá món khỏi thực đơn.' }
  } catch (error) {
    return fail(error)
  }
}

export async function createMenuItem(input: NewItemInput): Promise<ActionResult> {
  try {
    await assertAdminAccess('MANAGER')
    let catalogInput = catalogFields(input)
    const name = catalogInput.name

    // Nâng cấp cột lưu ảnh kiểu cũ trước khi Java nhận món mới.
    await ensureMenuImageStorage()
    const remote = await createJavaMenuItem(catalogInput)
    let javaId: number | undefined
    if (remote.ok) {
      javaId = remote.data.id
    } else if (!remote.unreachable) {
      if (remote.status !== 409) return { ok: false, error: remote.error }
      // Một lần lưu dở trước đó có thể đã tồn tại bên Java. Khôi phục dữ liệu thật của nó khi thử
      // lại.
      const catalog = await fetchMenu()
      if (!catalog.ok) return { ok: false, error: 'Chưa tải được thực đơn để đồng bộ món. Vui lòng thử lại.' }
      const existing = catalog.data.find(item => normalizeMenuName(item.name) === normalizeMenuName(name))
      if (!existing) return { ok: false, error: remote.error }
      javaId = existing.id
      catalogInput = {
        name: existing.name, category: existing.category,
        kind: existing.kind === 'ingredient' ? 'ingredient' : 'menu',
        unit: existing.unit, costPrice: existing.costPrice, sellPrice: existing.sellPrice,
        recipe: existing.recipe || '', imageUrl: existing.imageUrl || '',
        variations: existing.variations ?? [], inStock: existing.inStock,
      }
    }

    await persistMenuItem(catalogInput, javaId)
    refreshMenu()
    return { ok: true, message: catalogInput.name + ' đã được thêm vào thực đơn.' }
  } catch (error) {
    return fail(error)
  }
}

// Bản sao cục bộ của các đơn được hỏi: tìm trong database trước, phần còn lại tìm trong mock store
// (đơn rơi vào mock store khi ghi database thất bại).
async function loadOrdersByCode(codes: string[]): Promise<Order[]> {
  await ensureOrderTableGroups()
  let found: Order[] = []
  if (isDbConfigured && db) {
    try {
      found = await db.select().from(adminOrders).where(inArray(adminOrders.orderCode, codes))
    } catch {
      // Rơi xuống dùng mock store.
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
      // Rơi xuống dùng mock store.
    }
  }
  return getMockMenuItems()
}

type PushSummary = { sent: number; failed: string[]; unreachable: boolean }

// Gửi các đơn cục bộ trong hàng đợi tới POST /api/orders/sync (idempotent theo mã đơn) và gỡ những
// đơn Java đã có. Đơn bị Java từ chối vẫn ở trong hàng đợi kèm lý do.
async function pushQueuedOrders(codes: string[], asService = false): Promise<PushSummary> {
  const summary: PushSummary = { sent: 0, failed: [], unreachable: false }
  if (codes.length === 0) return summary
  const orders = await loadOrdersByCode(codes)
  const gone = codes.filter((code) => !orders.some((order) => order.orderCode === code))
  await dequeueSync(gone) // không còn gì ở cục bộ để gửi

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
    paid: order.paymentStatus === 'paid' || order.paymentStatus === 'refunded',
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
    if (queued.length === 0) return { ok: true, message: 'Mọi đơn hàng đã được đồng bộ.' }
    const summary = await pushQueuedOrders(queued)
    refresh()
    if (summary.unreachable) return { ok: false, error: 'Không kết nối được máy chủ; các đơn vẫn được giữ để đồng bộ lại.' }
    if (summary.failed.length > 0) {
      return { ok: false, error: `Đã đồng bộ ${summary.sent} đơn, ${summary.failed.length} đơn bị từ chối: ${summary.failed.slice(0, 3).join('; ')}` }
    }
    return { ok: true, message: `Đã đồng bộ ${summary.sent} đơn hàng lên máy chủ.` }
  } catch (error) {
    return fail(error)
  }
}

// Cài đặt quán nằm trong Singleton SystemConfigManager bên Java, nên không có bản dự phòng cục bộ.
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

// Tài khoản nằm ở backend Java (/api/users, ADMIN); không có bản dự phòng cục bộ.
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

// Nút chuyển chi nhánh trên header: mọi trang admin, POS và báo cáo đều theo chi nhánh đã chọn.
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
