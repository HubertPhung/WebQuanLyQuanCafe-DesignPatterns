import { GoogleSignIn, LoginForm } from '@/components/auth/auth-forms'
import { googleConfig } from '@/lib/auth/google'
import { safeNext } from '@/lib/auth/roles'

export const metadata = { title: 'Đăng nhập · Đà Lạt Cafe' }

const notices: Record<string, string> = {
  google_not_configured: 'Đăng nhập Google chưa được cấu hình trên máy chủ.',
  google_cancelled: 'Bạn đã huỷ đăng nhập Google.',
  google_state: 'Phiên đăng nhập Google đã hết hạn. Vui lòng thử lại.',
  google_failed: 'Không xác thực được tài khoản Google. Vui lòng thử lại.',
  google_unverified: 'Email Google này chưa được xác minh.',
  google_staff: 'Tài khoản nhân viên đăng nhập bằng email và mật khẩu, không dùng Google.',
  not_configured: 'Máy chủ chưa cấu hình AUTH_JWT_SECRET nên chưa thể đăng nhập.',
  backend_down: 'Máy chủ đăng nhập (Java) không phản hồi. Vui lòng thử lại sau.',
  disabled: 'Tài khoản đã bị khoá. Liên hệ quản trị viên.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  return (
    <>
      <h1 className="font-display text-[1.75rem] font-semibold leading-tight text-stone-900">
        Chào mừng trở lại <span className="sr-only">Sign in</span>
      </h1>
      <p className="mt-1 mb-6 text-sm text-stone-600">Nhân viên và khách hàng dùng chung một trang đăng nhập.</p>
      <GoogleSignIn next={safeNext(next) ?? ''} enabled={googleConfig() !== null} />
      <LoginForm next={safeNext(next) ?? ''} notice={error ? notices[error] : undefined} />
    </>
  )
}
