import { AuthShell, Divider } from '@/components/auth/auth-shell'
import { GoogleButton, LoginForm } from '@/components/auth/auth-forms'
import { googleConfig } from '@/lib/auth/google'
import { safeNext } from '@/lib/auth/roles'

export const metadata = { title: 'Đăng nhập · Đà Lạt Cafe' }

const errors: Record<string, string> = {
  google_not_configured: 'Đăng nhập Google chưa được cấu hình trên máy chủ.',
  google_cancelled: 'Bạn đã huỷ đăng nhập Google.',
  google_state: 'Phiên đăng nhập Google đã hết hạn. Vui lòng thử lại.',
  google_failed: 'Không xác thực được tài khoản Google. Vui lòng thử lại.',
  google_unverified: 'Email Google này chưa được xác minh.',
  backend_down: 'Máy chủ đăng nhập (Java) không phản hồi. Vui lòng thử lại sau.',
  disabled: 'Tài khoản đã bị khoá. Liên hệ quản trị viên.',
  not_configured: 'Máy chủ chưa cấu hình AUTH_JWT_SECRET nên chưa thể đăng nhập.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const target = safeNext(next) ?? ''
  return (
    <AuthShell title="Đăng nhập" description="Nhân viên và khách hàng dùng chung một trang đăng nhập.">
      <span className="sr-only">Sign in</span>
      {error && errors[error] && (
        <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errors[error]}
        </p>
      )}
      <GoogleButton next={target} enabled={googleConfig() !== null} />
      <Divider />
      <LoginForm next={target} />
    </AuthShell>
  )
}
