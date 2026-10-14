import { ReservationsManagement } from '@/components/admin/reservations-management'
import { PageHeading } from '@/components/admin/shared'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quản lý Đặt bàn · Coffee Shop Admin' }

export default function AdminReservationsPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Quản lý Đặt bàn & Tiếp nhận khách"
        description="Theo dõi lịch đặt bàn trước, các món khách chọn và chuyển sang đơn bán hàng tại POS."
      />
      <ReservationsManagement />
    </div>
  )
}

