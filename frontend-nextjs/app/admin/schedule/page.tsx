import { DemoNotice, PageHeading } from '@/components/admin/shared'
import { ScheduleManagement } from '@/components/admin/schedule-management'
import { requirePageRole } from '@/lib/auth/session'

export const metadata = { title: 'Lịch làm việc' }

export default async function SchedulePage() {
  await requirePageRole('MANAGER', '/admin/schedule')
  return (
    <>
      <PageHeading
        title="Lịch làm việc & Chấm công"
        description="Xếp lịch phân ca hàng tuần cho đội ngũ nhân viên, theo dõi trạng thái ca trực và chấm công chuyên nghiệp."
      />
      <DemoNotice>Lịch phân ca và chấm công là dữ liệu minh hoạ. Thay đổi ca chỉ hiển thị trong trình duyệt và không được lưu.</DemoNotice>
      <ScheduleManagement />
    </>
  )
}

