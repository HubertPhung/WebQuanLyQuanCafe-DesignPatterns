import { FloorPlan } from '@/components/admin/floor-plan'
import { AutoRefresh, PageHeading } from '@/components/admin/shared'
import { getActiveOrders, getTables } from '@/lib/admin/queries'

export const metadata = { title: 'Quản lý bàn' }

export default async function TablesPage() {
  const [tables, openOrders] = await Promise.all([getTables(), getActiveOrders()])
  return (
    <>
      <AutoRefresh />
      <PageHeading
        title={
          <>
            Sơ đồ bàn & Chỗ ngồi <span className="sr-only">Floor plan</span>
          </>
        }
        description="Chọn bàn để xem hóa đơn chi tiết, thời gian khách ngồi và chuyển đổi trạng thái bàn."
      />
      <FloorPlan tables={tables} openOrders={openOrders} />
    </>
  )
}
