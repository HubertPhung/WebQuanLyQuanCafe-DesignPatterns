import { OnlineOrders } from '@/components/admin/online-orders'
import { AutoRefresh, PageHeading } from '@/components/admin/shared'
import { getOnlineOrders } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quản lý Đơn hàng Online · Coffee Shop Admin' }

export default async function AdminOnlineOrdersPage() {
  const orders = await getOnlineOrders()
  return (
    <div className="space-y-6">
      <AutoRefresh />
      <PageHeading
        title="Quản lý Đơn hàng Online"
        description="Đơn khách đặt trên trang web: pha chế, giao hàng hoặc chờ khách lấy, và thu tiền khi nhận."
      />
      <OnlineOrders orders={orders} />
    </div>
  )
}
