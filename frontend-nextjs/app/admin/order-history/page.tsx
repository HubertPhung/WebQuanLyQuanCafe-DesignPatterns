import { OrderHistory } from '@/components/admin/order-history'
import { AutoRefresh, PageHeading } from '@/components/admin/shared'
import { getOrderHistory } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Lịch sử đơn hàng · Đà Lạt Cafe Admin' }

export default async function OrderHistoryPage() {
  const orders = await getOrderHistory()
  return (
    <div className="space-y-6">
      <AutoRefresh />
      <PageHeading
        title={
          <>
            Lịch sử đơn hàng <span className="sr-only">Order History</span>
          </>
        }
        description="Toàn bộ lịch sử giao dịch và hóa đơn bán hàng trực tuyến (online) và tại quầy (POS, bàn ăn)."
      />
      <OrderHistory orders={orders} />
    </div>
  )
}

