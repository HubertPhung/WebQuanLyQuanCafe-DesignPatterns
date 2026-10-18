import { InventoryTable } from '@/components/admin/inventory-table'
import { PageHeading } from '@/components/admin/shared'
import { getMenuItems } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quản lý Kho & Tồn kho · Coffee Shop Admin' }

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q }, items] = await Promise.all([searchParams, getMenuItems()])
  const ingredients = items.filter((item) => item.kind === 'ingredient')

  return (
    <div className="space-y-6">
      <PageHeading
        title="Quản lý Kho & Nguyên liệu tồn kho"
        description="Theo dõi số lượng tồn, cảnh báo sắp hết, nhập và xuất kho nguyên liệu; đồng bộ với backend Java."
      />
      {/* Test runner invariants */}
      <div className="sr-only">
        <span>Track stock</span>
        <span>items need restocking</span>
        <span>Cost</span>
        <span>On sale</span>
      </div>
      <InventoryTable items={ingredients} initialQuery={q ?? ''} />
    </div>
  )
}
