import { OnlineOrders } from '@/components/admin/online-orders'
import { PageHeading } from '@/components/admin/shared'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quản lý Đơn hàng Online · Coffee Shop Admin' }

export default function AdminOnlineOrdersPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Quản lý Đơn hàng Online"
        description="Tiếp nhận, xử lý pha chế, bàn giao shipper và quản lý quy trình giao hàng tận nơi."
      />
      <OnlineOrders />
    </div>
  )
}

