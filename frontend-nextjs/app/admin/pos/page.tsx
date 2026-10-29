import { KdsBoard } from '@/components/admin/kds-board'
import { OfflineSyncButton } from '@/components/admin/offline-sync-button'
import { PosTerminal } from '@/components/admin/pos-terminal'
import { GroupTablePayment } from '@/components/admin/group-table-payment'
import { AutoRefresh, PageHeading } from '@/components/admin/shared'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchConfig } from '@/lib/api-client'
import { getActiveOrders, getMenuItems, getPendingSyncCount, getTables } from '@/lib/admin/queries'
import { markTablesInUse } from '@/lib/admin/pos-table-availability'
import { loadActiveVouchers } from '@/lib/storefront/active-vouchers'

export const metadata = { title: 'Đơn hàng & POS' }

export default async function PosPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, menu, tables, activeOrders, pendingSync] = await Promise.all([
    searchParams,
    getMenuItems(),
    getTables(),
    getActiveOrders(),
    getPendingSyncCount(),
  ])
  // Giá trị điểm lấy từ SystemConfigManager bên Java, để bản xem trước ở POS khớp với hóa đơn. Mã
  // voucher đang chạy cũng lấy từ Java; không có Java thì danh sách rỗng và quầy không giảm giá.
  const [config, vouchers] = await Promise.all([fetchConfig(), loadActiveVouchers()])

  return (
    <>
      <AutoRefresh />
      <PageHeading title="Đơn hàng & POS" description="Gọi món nhanh tại quầy và điều phối quy trình pha chế theo thời gian thực.">
        <OfflineSyncButton pending={pendingSync} />
      </PageHeading>
      {/* Đặt key theo tab để link tới ?tab=kitchen vẫn chuyển tab kể cả khi trang POS đang mở sẵn. */}
      <Tabs key={tab === 'kitchen' ? 'kitchen' : 'pos'} defaultValue={tab === 'kitchen' ? 'kitchen' : 'pos'} className="gap-4">
        <TabsList>
          <TabsTrigger value="pos">
            Quầy bán hàng
          </TabsTrigger>
          <TabsTrigger value="kitchen">
            Màn hình pha chế ({activeOrders.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pos">
          <GroupTablePayment tables={tables} orders={activeOrders} />
          <PosTerminal menu={menu} tables={markTablesInUse(tables, activeOrders)} vouchers={vouchers} pointValue={config.ok ? config.data.pointRedeemValueVnd : undefined} />
        </TabsContent>
        <TabsContent value="kitchen">
          <KdsBoard orders={activeOrders} tables={tables} />
        </TabsContent>
      </Tabs>
    </>
  )
}
