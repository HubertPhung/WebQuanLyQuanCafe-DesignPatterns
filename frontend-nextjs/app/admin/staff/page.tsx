import { PageHeading } from '@/components/admin/shared'
import { StaffManagement } from '@/components/admin/staff-management'
import { requirePageRole } from '@/lib/auth/session'

export const metadata = { title: 'Nhân viên & Người dùng' }

export default async function StaffPage() {
  await requirePageRole('MANAGER', '/admin/staff')
  return (
    <>
      <PageHeading
        title="Nhân viên & Người dùng"
        description="Quản lý hồ sơ nhân sự, tài khoản thành viên khách hàng, phân quyền vai trò và mức lương/điểm tích lũy."
      />
      <StaffManagement />
    </>
  )
}
