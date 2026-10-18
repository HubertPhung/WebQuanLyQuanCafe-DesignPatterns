'use server'

import { createReservation as createJavaReservation, fetchReservationTables } from '@/lib/api-client'
import { isWithinDefaultOperatingHours, hasReservationTimePassed, DEFAULT_OPENING_TIME, DEFAULT_CLOSING_TIME } from '@/lib/reservation-rules'
import { createMockReservation, getMockTables, getMockMenuItems } from '@/lib/db/mock-store'
import { isDbConfigured } from '@/lib/db'
import { DEFAULT_BRANCH_ID, isBranchId, type BranchId } from '@/lib/branches'

export async function getCustomerReservationTables() {
  const remote = await fetchReservationTables()
  if (remote.ok) return { ok: true, tables: remote.data }
  if (isDbConfigured || !remote.unreachable) return { ok: false, tables: [], error: 'Chưa tải được danh sách bàn. Vui lòng thử lại.' }
  return { ok: true, tables: getMockTables().map(({ id, name, seats, zone, branch }) => ({ id, name, seats, zone, branch })) }
}

export interface CustomerReservationInput {
  customer: string
  contact: string
  email?: string
  note?: string
  dateTime: string
  guests: number
  tableId: number
  tableIds?: number[]
  // The tables must all belong to this branch.
  branch?: BranchId
  preOrders?: { menuItemId: number; qty: number }[]
}

export interface CustomerReservationResult {
  ok: boolean
  id?: string
  message?: string
  error?: string
}

export async function bookCustomerTable(input: CustomerReservationInput): Promise<CustomerReservationResult> {
  try {
    const customer = (input.customer ?? '').trim().slice(0, 60)
    const contact = (input.contact ?? '').trim().slice(0, 30)
    if (!customer || customer.length < 2) {
      return { ok: false, error: 'Vui lòng nhập họ và tên (ít nhất 2 ký tự).' }
    }
    if (!contact || !/^[0-9+() -]{8,20}$/.test(contact)) {
      return { ok: false, error: 'Vui lòng nhập số điện thoại hợp lệ (8 - 15 số).' }
    }
    if (!Number.isInteger(input.guests) || input.guests < 1 || input.guests > 20) {
      return { ok: false, error: 'Số lượng khách phải từ 1 đến 20 người.' }
    }
    const tableIds = input.tableIds ?? [input.tableId]
    if (!Array.isArray(tableIds) || tableIds.length === 0 || tableIds.length > 10 || new Set(tableIds).size !== tableIds.length || tableIds.some(id => !Number.isInteger(id) || id < 1)) {
      return { ok: false, error: 'Vui lòng chọn vị trí bàn mong muốn.' }
    }

    if (input.branch !== undefined && !isBranchId(input.branch)) {
      return { ok: false, error: 'Vui lòng chọn chi nhánh.' }
    }
    const branch = input.branch ?? DEFAULT_BRANCH_ID

    const dateTime = new Date(input.dateTime)
    if (Number.isNaN(dateTime.getTime())) {
      return { ok: false, error: 'Thời gian đặt bàn không hợp lệ.' }
    }
    if (hasReservationTimePassed(dateTime)) {
      return { ok: false, error: 'Không thể đặt bàn cho thời điểm đã qua trong quá khứ.' }
    }
    if (!isWithinDefaultOperatingHours(dateTime)) {
      return { ok: false, error: `Quán chỉ phục vụ đặt bàn trong khung giờ mở cửa (${DEFAULT_OPENING_TIME} - ${DEFAULT_CLOSING_TIME}).` }
    }

    const booking = {
      customer,
      contact,
      email: input.email?.trim() || undefined,
      note: input.note?.trim().slice(0, 500) || undefined,
      dateTime: dateTime.toISOString(),
      guests: input.guests,
      tableId: tableIds[0],
      tableIds,
      branch,
      preOrders: input.preOrders && input.preOrders.length > 0 ? input.preOrders : undefined,
    }

    // Call Java backend Chain of Responsibility validation & DAO persistence
    const remote = await createJavaReservation(booking)
    if (remote.ok) {
      return {
        ok: true,
        id: remote.data.id,
        message: `Đặt bàn thành công! Mã phiếu của bạn là ${remote.data.id}. Quán sẽ chuẩn bị sẵn sàng đón bạn.`,
      }
    }

    if (!remote.unreachable) {
      return { ok: false, error: remote.error || 'Yêu cầu đặt bàn không thành công.' }
    }

    // If Java is temporarily offline, use mock store fallback
    if (isDbConfigured) return { ok: false, error: 'Dịch vụ đặt bàn đang gián đoạn. Chưa ghi nhận đặt bàn, vui lòng thử lại.' }
    const menu = getMockMenuItems()
    const preOrders = (booking.preOrders ?? []).map(line => {
      const item = menu.find(item => item.id === line.menuItemId && item.kind === 'menu' && item.inStock)
      if (!item || !Number.isInteger(line.qty) || line.qty < 1) throw new Error('Món đặt trước không hợp lệ.')
      return { name: item.name, qty: line.qty, price: item.sellPrice }
    })
    const mockRes = createMockReservation({
      customer: booking.customer,
      contact: booking.contact,
      email: booking.email ?? null,
      note: booking.note ?? null,
      dateTime,
      guests: booking.guests,
      tableId: booking.tableId,
      tableIds,
      branch,
      preOrders,
    })

    if (mockRes.ok && mockRes.code) {
      return {
        ok: true,
        id: mockRes.code,
        message: `Đặt bàn thành công! Mã phiếu: ${mockRes.code}. Đã ghi nhận lịch hẹn của bạn.`,
      }
    }

    return { ok: false, error: mockRes.error || 'Đặt bàn chưa thành công, vui lòng thử lại sau ít phút.' }
  } catch (error) {
    return { ok: false, error: (error as Error).message || 'Đã xảy ra lỗi không mong muốn.' }
  }
}
