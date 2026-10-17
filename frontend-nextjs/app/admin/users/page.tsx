import { PageHeading } from '@/components/admin/shared'
import { UsersManagement } from '@/components/admin/users-management'
import { fetchUsers } from '@/lib/api-client'
import { requirePageRole } from '@/lib/auth/session'

export const metadata = { title: 'Tài khoản & phân quyền' }

export default async function UsersPage() {
  const session = await requirePageRole('ADMIN', '/admin/users')
  const remote = await fetchUsers()
  return (
    <>
      <PageHeading
        title={
          <>
            Tài khoản & phân quyền <span className="sr-only">Users</span>
          </>
        }
        description="Khách hàng tự đăng ký; quản trị viên cấp và đổi vai trò Nhân viên, Quản lý, Quản trị viên. Thay đổi có hiệu lực ngay."
      />
      {remote.ok ? (
        <UsersManagement users={remote.data} currentUserId={session.userId} />
      ) : (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {remote.unreachable
            ? 'Máy chủ Java không phản hồi nên chưa đọc được danh sách tài khoản.'
            : `Không đọc được danh sách tài khoản: ${remote.error}`}
        </p>
      )}
    </>
  )
}
