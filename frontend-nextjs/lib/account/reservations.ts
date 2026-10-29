import 'server-only'
import { fetchMyReservations, getJavaBackendUrl } from '@/lib/api-client'
import type { Session } from '@/lib/auth/session'
import { getMockReservations } from '@/lib/db/mock-store'
import type { BranchId } from '@/lib/branches'
import { reservationEnd } from '@/lib/reservation-rules'

export type AccountReservation = {
  code: string
  scheduledAt: string
  // Giờ kết thúc (ISO); phiếu cũ là giờ bắt đầu + 2 giờ.
  endAt: string
  table: string
  branch: BranchId
  guests: number
  status: string
  note: string | null
  preOrders: { name: string; qty: number; price: number }[]
}

export async function getAccountReservations(session: Session): Promise<{
  reservations: AccountReservation[]
  reservationsUnavailable: boolean
}> {
  const remote = await fetchMyReservations(session.token)
  const email = session.email.trim().toLowerCase()
  const local = getMockReservations()
    .filter(reservation => reservation.userId != null
      ? reservation.userId === session.userId
      : Boolean(email) && reservation.email?.trim().toLowerCase() === email)
    .map<AccountReservation>(reservation => ({
      code: reservation.code,
      scheduledAt: reservation.dateTime.toISOString(),
      endAt: reservationEnd(reservation).toISOString(),
      table: reservation.tableName,
      branch: reservation.branch,
      guests: reservation.guests,
      status: reservation.status === 'Hoàn thành' ? 'Đã nhận bàn' : reservation.status,
      note: reservation.note,
      preOrders: reservation.preOrders,
    }))
  const fromJava: AccountReservation[] = remote.ok ? remote.data.map(reservation => ({
    code: reservation.id,
    scheduledAt: reservation.dateTime,
    endAt: reservation.endTime ?? reservationEnd({ dateTime: new Date(reservation.dateTime) }).toISOString(),
    table: reservation.table ?? 'Đang xếp bàn',
    branch: reservation.branch,
    guests: reservation.guests,
    status: reservation.status === 'Khách đã nhận bàn' ? 'Đã nhận bàn' : reservation.status,
    note: reservation.note,
    preOrders: reservation.preOrders ?? [],
  })) : []
  return {
    reservations: [...fromJava, ...local]
      .sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt)).slice(0, 50),
    reservationsUnavailable: !remote.ok && getJavaBackendUrl() !== null,
  }
}
