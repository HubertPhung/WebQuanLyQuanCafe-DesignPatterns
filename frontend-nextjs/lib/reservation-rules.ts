// Quy tắc đặt bàn mà frontend tự áp dụng. Mỗi giá trị khớp với một hằng số bên Java; hãy giữ chúng
// đồng bộ. Khi Java kết nối được thì Chain of Responsibility của nó có tiếng nói cuối cùng. Bản dự
// phòng cục bộ chỉ chạy khi Java ngừng hoạt động, nên nó không đọc được /api/config và dùng giá trị
// mặc định của Java.

/** OperatingHoursValidator.PAST_GRACE: phiếu nhập cho "bây giờ" đã bắt đầu rồi. */
export const RESERVATION_PAST_GRACE_MS = 15 * 60 * 1000

/** Reservation.DEFAULT_LENGTH: phiếu không ghi giờ kết thúc giữ bàn hai giờ. */
export const RESERVATION_DEFAULT_LENGTH_MS = 2 * 60 * 60 * 1000

/** OperatingHoursValidator.MIN_LENGTH: một phiếu giữ bàn ít nhất 30 phút. */
export const RESERVATION_MIN_LENGTH_MS = 30 * 60 * 1000

/** SystemConfigManager.DEFAULT_AUTO_CANCEL_MINUTES: phiếu chưa nhận bàn tự hủy sau 30 phút. */
export const RESERVATION_NO_SHOW_GRACE_MS = 30 * 60 * 1000

/** SystemConfigManager.DEFAULT_OPENING_TIME / DEFAULT_CLOSING_TIME, tính cả hai mốc. */
export const DEFAULT_OPENING_TIME = '07:00'
export const DEFAULT_CLOSING_TIME = '22:00'

/** SystemConfigManager.DEFAULT_MAX_RESERVATION_GUESTS. */
export const DEFAULT_MAX_RESERVATION_GUESTS = 20
export const RESERVATION_TIME_SLOTS = Array.from({ length: 31 }, (_, index) => {
  const minutes = 7 * 60 + index * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

// Việt Nam giữ UTC+7 quanh năm (không có giờ mùa hè), nên một độ lệch cố định khớp với
// Asia/Ho_Chi_Minh.
const CAFE_UTC_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function secondsOfCafeDay(date: Date): number {
  const local = (((date.getTime() + CAFE_UTC_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS
  return Math.floor(local / 1000)
}

function secondsOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 3600 + minutes * 60
}

export function hasReservationTimePassed(dateTime: Date, now = Date.now()): boolean {
  return dateTime.getTime() < now - RESERVATION_PAST_GRACE_MS
}

/** Mở đơn POS là bắt đầu đồng hồ của quầy pha chế, nên không bao giờ mở trước giờ đặt. */
export function hasReservationStarted(dateTime: Date, now = Date.now()): boolean {
  return Number.isFinite(dateTime.getTime()) && dateTime.getTime() <= now
}

export function isWithinDefaultOperatingHours(dateTime: Date): boolean {
  const seconds = secondsOfCafeDay(dateTime)
  return seconds >= secondsOf(DEFAULT_OPENING_TIME) && seconds <= secondsOf(DEFAULT_CLOSING_TIME)
}

/**
 * Cùng phép kiểm tra trùng như TableAvailabilityValidator: hai khoảng nửa mở [start, end) giao
 * nhau, nên hai phiếu nối tiếp nhau không bị coi là trùng.
 */
export function reservationRangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime()
}

/** Giờ kết thúc của một phiếu; phiếu cũ không ghi giờ kết thúc giữ bàn hai giờ. */
export function reservationEnd(reservation: { dateTime: Date; endTime?: Date | null }): Date {
  return reservation.endTime ?? new Date(reservation.dateTime.getTime() + RESERVATION_DEFAULT_LENGTH_MS)
}

function slotLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Các mốc giờ kết thúc chọn được: sau giờ bắt đầu ít nhất 30 phút, không quá giờ đóng cửa. */
export function endSlotsAfter(start: string, closing = DEFAULT_CLOSING_TIME): string[] {
  const earliest = secondsOf(start) + RESERVATION_MIN_LENGTH_MS / 1000
  return RESERVATION_TIME_SLOTS.filter((slot) => secondsOf(slot) >= earliest && secondsOf(slot) <= secondsOf(closing))
}

/** Giờ kết thúc gợi ý: hai giờ sau giờ bắt đầu, cắt về giờ đóng cửa; null khi không còn đủ 30 phút. */
export function defaultEndSlot(start: string, closing = DEFAULT_CLOSING_TIME): string | null {
  if (endSlotsAfter(start, closing).length === 0) return null
  return slotLabel(Math.min(secondsOf(start) + RESERVATION_DEFAULT_LENGTH_MS / 1000, secondsOf(closing)))
}

/** ReservationHandler.defaultEndTime: hai giờ sau giờ bắt đầu, cắt về giờ đóng cửa của cùng ngày. */
export function defaultReservationEnd(start: Date, closing = DEFAULT_CLOSING_TIME): Date {
  const dayStart = start.getTime() - secondsOfCafeDay(start) * 1000
  const closingAt = dayStart + secondsOf(closing) * 1000
  return new Date(Math.min(start.getTime() + RESERVATION_DEFAULT_LENGTH_MS, closingAt))
}

/** Lỗi của khoảng giờ đặt bàn, cùng thông báo với OperatingHoursValidator bên Java; hợp lệ thì null. */
export function reservationRangeError(start: Date, end: Date, closing = DEFAULT_CLOSING_TIME): string | null {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 'Giờ kết thúc không hợp lệ.'
  if (end.getTime() - start.getTime() < RESERVATION_MIN_LENGTH_MS) return 'Giờ kết thúc phải sau giờ bắt đầu ít nhất 30 phút.'
  const sameDay = Math.floor((start.getTime() + CAFE_UTC_OFFSET_MS) / DAY_MS) === Math.floor((end.getTime() + CAFE_UTC_OFFSET_MS) / DAY_MS)
  if (!sameDay) return 'Giờ kết thúc không hợp lệ.'
  if (secondsOfCafeDay(end) > secondsOf(closing)) return `Giờ kết thúc không được quá giờ đóng cửa (${closing}).`
  return null
}
