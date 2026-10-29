import 'server-only'
import { fetchReservationTables, getJavaBackendUrl } from '@/lib/api-client'
import { getMockReservations, getMockTables } from '@/lib/db/mock-store'
import { isBranchId, type BranchId } from '@/lib/branches'
import { defaultReservationEnd, reservationEnd, reservationRangesOverlap } from '@/lib/reservation-rules'
import { isDbConfigured } from '@/lib/db'

// Bàn trống trong khoảng [dateTime, endTime); thiếu giờ kết thúc thì như khi đặt (+2 giờ, cắt ở giờ đóng cửa).
export async function getReservationTableOptions(dateTime?: string, branch?: BranchId, endTime?: string) {
  const slot = dateTime ? new Date(dateTime) : null
  const slotEnd = slot ? (endTime ? new Date(endTime) : defaultReservationEnd(slot)) : null
  if ((slot && !Number.isFinite(slot.getTime())) || (slotEnd && !Number.isFinite(slotEnd.getTime())) || (branch && !isBranchId(branch))) {
    return { ok: false, tables: [], error: 'Ngày giờ hoặc chi nhánh không hợp lệ.' }
  }
  const remote = await fetchReservationTables(slot?.toISOString(), branch, endTime ? slotEnd?.toISOString() : undefined)
  if (remote.ok) {
    if (!slot || remote.data.every(table => typeof table.available === 'boolean')) return { ok: true, tables: remote.data }
    return { ok: false, tables: [], error: 'Chưa kiểm tra được lịch bàn. Vui lòng thử lại.' }
  }
  if (isDbConfigured || getJavaBackendUrl() || !remote.unreachable) return { ok: false, tables: [], error: 'Chưa kiểm tra được lịch bàn. Vui lòng thử lại.' }
  const bookings = slot && slotEnd
    ? getMockReservations().filter(booking => booking.status !== 'Đã hủy' && reservationRangesOverlap(booking.dateTime, reservationEnd(booking), slot, slotEnd))
    : []
  return {
    ok: true,
    tables: getMockTables().filter(table => !branch || table.branch === branch).map(({ id, name, seats, zone, branch }) => ({
      id, name, seats, zone, branch,
      available: !bookings.some(booking => (booking.tableIds ?? [booking.tableId]).includes(id)),
    })),
  }
}
