// Reservation rules the frontend applies itself. Each value mirrors a Java constant; keep them in step.
// While Java is reachable its Chain of Responsibility has the final word. The local fallback runs only
// when Java is down, so it cannot read /api/config and uses the Java defaults instead.

/** OperatingHoursValidator.PAST_GRACE: a booking keyed in for "now" has already begun. */
export const RESERVATION_PAST_GRACE_MS = 15 * 60 * 1000

/** TableAvailabilityValidator.DEFAULT_DURATION: every booking holds its table for two hours. */
export const RESERVATION_SLOT_MS = 2 * 60 * 60 * 1000

/** SystemConfigManager.DEFAULT_OPENING_TIME / DEFAULT_CLOSING_TIME, both bounds included. */
export const DEFAULT_OPENING_TIME = '07:00'
export const DEFAULT_CLOSING_TIME = '22:00'

/** SystemConfigManager.DEFAULT_MAX_RESERVATION_GUESTS. */
export const DEFAULT_MAX_RESERVATION_GUESTS = 20
export const RESERVATION_TIME_SLOTS = Array.from({ length: 31 }, (_, index) => {
  const minutes = 7 * 60 + index * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

// Vietnam keeps UTC+7 all year (no daylight saving), so a fixed offset matches Asia/Ho_Chi_Minh.
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

/** Opening a POS order starts the kitchen timer, so never open it before the booking. */
export function hasReservationStarted(dateTime: Date, now = Date.now()): boolean {
  return Number.isFinite(dateTime.getTime()) && dateTime.getTime() <= now
}

export function isWithinDefaultOperatingHours(dateTime: Date): boolean {
  const seconds = secondsOfCafeDay(dateTime)
  return seconds >= secondsOf(DEFAULT_OPENING_TIME) && seconds <= secondsOf(DEFAULT_CLOSING_TIME)
}

/** Same overlap test as TableAvailabilityValidator: [start, start + slot) ranges intersect. */
export function reservationSlotsOverlap(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime() + RESERVATION_SLOT_MS && b.getTime() < a.getTime() + RESERVATION_SLOT_MS
}
