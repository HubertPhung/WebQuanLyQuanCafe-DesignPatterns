import { ReservationsManagement } from '@/components/admin/reservations-management'
import { PageHeading } from '@/components/admin/shared'
import { getReservations, getTables } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quản lý Đặt bàn · Coffee Shop Admin' }

export default async function AdminReservationsPage() {
  const [{ reservations, javaOnline }, tables] = await Promise.all([getReservations(), getTables()])
  // Remount the client list whenever the server data changes, so local edits never mask fresh data.
  const dataKey = reservations.map((r) => `${r.source}:${r.id}:${r.status}`).join('|')

  return (
    <div className="space-y-6">
      <PageHeading
        title="Quản lý Đặt bàn & Tiếp nhận khách"
        description="Theo dõi lịch đặt bàn trước, các món khách chọn và chuyển sang đơn bán hàng tại POS."
      />
      <ReservationsManagement key={dataKey} reservations={reservations} tables={tables} javaOnline={javaOnline} />
    </div>
  )
}
