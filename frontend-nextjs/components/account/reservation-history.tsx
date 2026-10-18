import { CalendarDays, Clock, MapPin, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { AccountReservation } from '@/lib/account/reservations'
import { branchById } from '@/lib/branches'

const slotFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export function ReservationHistory({ reservations, unavailable }: { reservations: AccountReservation[]; unavailable: boolean }) {
  return (
    <section className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-5">
      <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
        <CalendarDays className="size-5 text-[#3E2723]" />
        Lịch sử đặt bàn
      </h3>
      {unavailable && <p role="status" className="text-xs text-amber-800">Chưa tải được đầy đủ lịch sử đặt bàn. Vui lòng thử lại sau.</p>}
      {reservations.length === 0 ? (
        !unavailable && <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-xs text-stone-500">Bạn chưa có lịch đặt bàn nào.</p>
      ) : (
        <div className="space-y-3.5">
          {reservations.map(reservation => (
            <article key={reservation.code} className="rounded-xl border border-stone-200/80 p-4 hover:border-amber-300 transition-all space-y-2 bg-stone-50/40">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-mono font-bold text-stone-900">#{reservation.code}</span>
                <Badge variant="outline" className="text-[11px] font-semibold">{reservation.status}</Badge>
              </div>
              <p className="flex items-center gap-2 text-xs font-semibold text-[#3E2723]">
                <Clock className="size-4" />Giờ nhận bàn: {slotFormat.format(new Date(reservation.scheduledAt))}
              </p>
              <p className="flex items-center gap-2 text-xs text-stone-700">
                <Users className="size-4" />{reservation.table.replaceAll('Table', 'Bàn')} · {reservation.guests} khách
              </p>
              <p className="flex items-center gap-2 text-xs text-stone-500">
                <MapPin className="size-4" />{branchById(reservation.branch).name}
              </p>
              {reservation.preOrders.length > 0 && <p className="text-xs text-stone-700 font-medium">Món đặt trước: {reservation.preOrders.map(item => `${item.name} (x${item.qty})`).join(', ')}</p>}
              {reservation.note && <p className="text-xs text-stone-500">Ghi chú: {reservation.note}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
