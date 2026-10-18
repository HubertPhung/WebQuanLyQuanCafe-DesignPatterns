import { MenuManagement } from '@/components/admin/menu-management'
import { PageHeading } from '@/components/admin/shared'
import { getMenuItems } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quản lý Menu & Danh mục món · Coffee Shop Admin' }

export default async function AdminMenuPage() {
  const items = await getMenuItems()
  return (
    <div className="space-y-6">
      <PageHeading
        title="Quản lý Thực đơn & Danh mục món"
        description="Danh sách món POS đang bán, đồng bộ với backend Java: thêm món mới và bật, tắt món đang bán."
      />
      <MenuManagement items={items} />
    </div>
  )
}
