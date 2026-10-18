import { KdsBoard } from '@/components/admin/kds-board'
import { OfflineSyncButton } from '@/components/admin/offline-sync-button'
import { PosTerminal } from '@/components/admin/pos-terminal'
import { GroupTablePayment } from '@/components/admin/group-table-payment'
import { AutoRefresh, PageHeading } from '@/components/admin/shared'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchConfig } from '@/lib/api-client'
import { getActiveOrders, getMenuItems, getPendingSyncCount, getTables } from '@/lib/admin/queries'

export const metadata = { title: 'Đơn hàng & POS' }

export default async function PosPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, menu, tables, activeOrders, pendingSync] = await Promise.all([
    searchParams,
    getMenuItems(),
    getTables(),
    getActiveOrders(),
    getPendingSyncCount(),
  ])
  // Point value from the Java SystemConfigManager, so the POS preview matches the receipt.
  const config = await fetchConfig()

  return (
    <>
      <AutoRefresh />
      <PageHeading title="Đơn hàng & POS" description="Gọi món nhanh tại quầy và điều phối quy trình pha chế theo thời gian thực.">
        <OfflineSyncButton pending={pendingSync} />
      </PageHeading>
      <Tabs defaultValue={tab === 'kitchen' ? 'kitchen' : 'pos'} className="gap-4">
        <TabsList>
          <TabsTrigger value="pos">
            Máy bán hàng POS <span className="sr-only">Point of sale</span>
          </TabsTrigger>
          <TabsTrigger value="kitchen">
            Màn hình pha chế ({activeOrders.length}) <span className="sr-only">Kitchen display</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pos">
          <GroupTablePayment tables={tables} orders={activeOrders} />
          <PosTerminal menu={menu} tables={tables} pointValue={config.ok ? config.data.pointRedeemValueVnd : undefined} />
        </TabsContent>
        <TabsContent value="kitchen">
          <KdsBoard orders={activeOrders} />
        </TabsContent>
      </Tabs>
    </>
  )
}
