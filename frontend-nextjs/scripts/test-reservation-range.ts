import assert from 'node:assert/strict'
import { createMockReservation, getMockReservations, updateMockReservation } from '../lib/db/mock-store'
import {
  defaultReservationEnd,
  defaultEndSlot,
  endSlotsAfter,
  reservationEnd,
  reservationRangeError,
  reservationRangesOverlap,
  RESERVATION_DEFAULT_LENGTH_MS,
} from '../lib/reservation-rules'

// Cùng quy tắc với OperatingHoursValidator / TableAvailabilityValidator bên Java (07:00–22:00).
const at = (time: string, day = '2026-11-05') => new Date(`${day}T${time}:00+07:00`)

assert.deepEqual(endSlotsAfter('21:00'), ['21:30', '22:00'])
assert.deepEqual(endSlotsAfter('21:45'), [])
assert.deepEqual(endSlotsAfter('22:00'), [])
assert.equal(endSlotsAfter('07:00')[0], '07:30')

assert.equal(defaultEndSlot('18:00'), '20:00')
assert.equal(defaultEndSlot('21:00'), '22:00')
assert.equal(defaultEndSlot('21:30'), '22:00')
assert.equal(defaultEndSlot('21:45'), null)

assert.equal(reservationRangeError(at('18:00'), at('18:29')), 'Giờ kết thúc phải sau giờ bắt đầu ít nhất 30 phút.')
assert.equal(reservationRangeError(at('18:00'), at('17:00')), 'Giờ kết thúc phải sau giờ bắt đầu ít nhất 30 phút.')
assert.equal(reservationRangeError(at('21:00'), at('22:30')), 'Giờ kết thúc không được quá giờ đóng cửa (22:00).')
assert.equal(reservationRangeError(at('21:00'), at('07:30', '2026-11-06')), 'Giờ kết thúc không hợp lệ.')
assert.equal(reservationRangeError(at('18:00'), at('18:30')), null)
assert.equal(reservationRangeError(at('21:00'), at('22:00')), null)

assert.equal(reservationRangesOverlap(at('18:00'), at('19:00'), at('19:00'), at('20:30')), false, 'back to back')
assert.equal(reservationRangesOverlap(at('18:00'), at('19:00'), at('18:45'), at('19:15')), true)

assert.equal(reservationEnd({ dateTime: at('18:00') }).getTime(), at('18:00').getTime() + RESERVATION_DEFAULT_LENGTH_MS)
assert.equal(reservationEnd({ dateTime: at('18:00'), endTime: at('18:45') }).getTime(), at('18:45').getTime())

// Phiếu cũ 20:30 không lưu giờ kết thúc vẫn sửa được (giờ kết thúc mặc định cắt về 22:00), như Java.
assert.equal(defaultReservationEnd(at('20:30')).getTime(), at('22:00').getTime())
const evening = new Date(Date.now() + 3 * 86_400_000)
const eveningDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(evening)
const legacyStart = at('20:30', eveningDay)
const created = createMockReservation({ customer: 'Khach cu', contact: '0901234567', email: null, note: null, dateTime: legacyStart, guests: 2, tableId: 2 })
assert.equal(created.ok, true, created.error)
const legacy = getMockReservations().find(reservation => reservation.code === created.code)!
legacy.endTime = null
const edited = updateMockReservation(created.code!, { customer: 'Khach cu', contact: '0909999999', email: null, note: null, dateTime: legacyStart, guests: 2, tableId: 2 })
assert.equal(edited.ok, true, edited.error)
const reread = getMockReservations().find(reservation => reservation.code === created.code)!
assert.equal(reread.endTime?.getTime(), at('22:00', eveningDay).getTime())

console.log('reservation range: all checks passed')
