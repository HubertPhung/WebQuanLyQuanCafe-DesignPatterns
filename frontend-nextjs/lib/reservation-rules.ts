// Quy tắc đặt bàn mà frontend tự áp dụng. Mỗi giá trị khớp với một hằng số bên Java; hãy giữ chúng
// đồng bộ. Khi Java kết nối được thì Chain of Responsibility của nó có tiếng nói cuối cùng. Bản dự
// phòng cục bộ chỉ chạy khi Java ngừng hoạt động, nên nó không đọc được /api/config và dùng giá trị
// mặc định của Java.

/** OperatingHoursValidator.PAST_GRACE: phiếu nhập cho "bây giờ" đã bắt đầu rồi. */
export const RESERVATION_PAST_GRACE_MS = 15 * 60 * 1000

/** TableAvailabilityValidator.DEFAULT_DURATION: mỗi phiếu giữ bàn trong hai giờ. */
export const RESERVATION_SLOT_MS = 2 * 60 * 60 * 1000

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
 * Cùng phép kiểm tra trùng như TableAvailabilityValidator: hai khoảng [start, start + slot) giao
 * nhau.
 */
export function reservationSlotsOverlap(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime() + RESERVATION_SLOT_MS && b.getTime() < a.getTime() + RESERVATION_SLOT_MS
}
