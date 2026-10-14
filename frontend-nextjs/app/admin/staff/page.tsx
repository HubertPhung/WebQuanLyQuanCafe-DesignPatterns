import { PageHeading } from '@/components/admin/shared'
import { StaffManagement } from '@/components/admin/staff-management'

export const metadata = { title: 'Nhân viên & Người dùng' }

export default function StaffPage() {
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
