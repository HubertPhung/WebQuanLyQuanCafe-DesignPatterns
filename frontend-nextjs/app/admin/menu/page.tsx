import { MenuManagement } from '@/components/admin/menu-management'
import { PageHeading } from '@/components/admin/shared'
import { getMenuItems } from '@/lib/admin/queries'
import { getSession } from '@/lib/auth/session'
import { atLeast } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quản lý Menu & Danh mục món · Coffee Shop Admin' }

export default async function AdminMenuPage() {
  const [items, session] = await Promise.all([getMenuItems(), getSession()])
  return (
    <div className="space-y-6">
      <PageHeading
        title="Quản lý Thực đơn & Danh mục món"
        description="Danh sách món POS đang bán, đồng bộ với backend Java: thêm, sửa, xoá món và bật, tắt món đang bán."
      />
      {/* Adding, editing and removing items needs MANAGER; staff can only switch items on or off. */}
      <MenuManagement items={items} canManage={session ? atLeast(session.role, 'MANAGER') : false} />
    </div>
  )
}
