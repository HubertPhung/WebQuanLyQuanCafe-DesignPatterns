import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { ChangePasswordForm } from '@/components/auth/auth-forms'
import { Button } from '@/components/ui/button'
import { signOut } from '@/app/auth/actions'
import { atLeast, roleLabels } from '@/lib/auth/roles'
import { requirePageRole } from '@/lib/auth/session'

export const metadata = { title: 'Tài khoản · Đà Lạt Cafe' }

export default async function AccountPage() {
  const session = await requirePageRole('CUSTOMER', '/account/security')
  return (
    <AuthShell title="Tài khoản của bạn" description="Thông tin đăng nhập và mật khẩu.">
      <span className="sr-only">Account</span>
      <dl className="mb-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-stone-500">Họ tên</dt>
        <dd className="font-semibold text-stone-900">{session.name}</dd>
        <dt className="text-stone-500">Email</dt>
        <dd className="font-semibold text-stone-900 break-all">{session.email}</dd>
        <dt className="text-stone-500">Vai trò</dt>
        <dd className="font-semibold text-stone-900">{roleLabels[session.role]}</dd>
      </dl>
      <ChangePasswordForm hasPassword />
      <p className="mt-2 text-xs text-stone-500">
        Tài khoản tạo bằng Google chưa có mật khẩu: để trống ô mật khẩu hiện tại không được, hãy đăng nhập bằng Google.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {atLeast(session.role, 'STAFF') ? (
          <Link href="/admin" className="text-sm font-semibold text-[#5A3E2B] hover:underline">
            Vào trang quản trị
          </Link>
        ) : (
          <Link href="/" className="text-sm font-semibold text-[#5A3E2B] hover:underline">
            Về trang đặt món
          </Link>
        )}
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Đăng xuất
          </Button>
        </form>
      </div>
    </AuthShell>
  )
}
