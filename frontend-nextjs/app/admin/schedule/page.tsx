import { PageHeading } from '@/components/admin/shared'
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
      <p className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">Lịch phân ca chưa kết nối hệ thống nhân sự. Thay đổi chỉ có hiệu lực trong trang đang mở và sẽ mất khi tải lại.</p>
      <ScheduleManagement />
    </>
  )
}

