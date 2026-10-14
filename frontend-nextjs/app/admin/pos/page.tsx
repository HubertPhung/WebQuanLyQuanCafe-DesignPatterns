import { KdsBoard } from '@/components/admin/kds-board'
import { PosTerminal } from '@/components/admin/pos-terminal'
import { AutoRefresh, PageHeading } from '@/components/admin/shared'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getActiveOrders, getMenuItems, getTables } from '@/lib/admin/queries'

export const metadata = { title: 'Đơn hàng & POS' }

export default async function PosPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, menu, tables, activeOrders] = await Promise.all([searchParams, getMenuItems(), getTables(), getActiveOrders()])

  return (
    <>
      <AutoRefresh />
      <PageHeading title="Đơn hàng & POS" description="Gọi món nhanh tại quầy và điều phối quy trình pha chế theo thời gian thực." />
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
          <PosTerminal menu={menu} tables={tables} />
        </TabsContent>
        <TabsContent value="kitchen">
          <KdsBoard orders={activeOrders} />
        </TabsContent>
      </Tabs>
    </>
  )
}
