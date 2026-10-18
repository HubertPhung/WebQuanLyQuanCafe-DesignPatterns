import 'server-only'
import { fetchMyReservations, getJavaBackendUrl } from '@/lib/api-client'
import type { Session } from '@/lib/auth/session'
import { getMockReservations } from '@/lib/db/mock-store'
import type { BranchId } from '@/lib/branches'

export type AccountReservation = {
  code: string
  scheduledAt: string
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
