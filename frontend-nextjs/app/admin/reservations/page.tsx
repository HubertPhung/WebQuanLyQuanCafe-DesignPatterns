import { ReservationsManagement } from '@/components/admin/reservations-management'
import { PageHeading } from '@/components/admin/shared'
import { getReservations, getTables } from '@/lib/admin/queries'
import { fetchConfig } from '@/lib/api-client'
import { DEFAULT_MAX_RESERVATION_GUESTS } from '@/lib/reservation-rules'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quản lý Đặt bàn · Coffee Shop Admin' }

export default async function AdminReservationsPage() {
  const [{ reservations, javaOnline }, tables, config] = await Promise.all([getReservations(), getTables(), fetchConfig()])
  // Admin có thể đổi giới hạn số khách bên Java; khi offline, form dùng cùng giá trị mặc định với
  // bản dự phòng cục bộ.
  const maxGuests = config.ok ? config.data.maxReservationGuests : DEFAULT_MAX_RESERVATION_GUESTS
  // Gắn lại danh sách phía client mỗi khi dữ liệu server thay đổi, để sửa đổi cục bộ không che mất
  // dữ liệu mới.
  const dataKey = reservations.map((r) => `${r.source}:${r.id}:${r.status}`).join('|')

  return (
    <div className="space-y-6">
      <PageHeading
        title="Quản lý Đặt bàn & Tiếp nhận khách"
        description="Theo dõi lịch đặt bàn trước, các món khách chọn và chuyển sang đơn bán hàng tại POS."
      />
      <ReservationsManagement key={dataKey} reservations={reservations} tables={tables} javaOnline={javaOnline} maxGuests={maxGuests} />
    </div>
  )
}
