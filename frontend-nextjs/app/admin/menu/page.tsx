import { MenuManagement } from '@/components/admin/menu-management'
import { PageHeading } from '@/components/admin/shared'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quản lý Menu & Danh mục món · Coffee Shop Admin' }

export default function AdminMenuPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Quản lý Thực đơn & Danh mục món"
        description="Quản lý toàn bộ danh sách thức uống, món ăn kèm đơn giá và danh mục hiển thị."
      />
      <MenuManagement />
    </div>
  )
}

