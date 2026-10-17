import { LoginForm } from '@/components/auth/auth-forms'
import { safeNext } from '@/lib/auth/roles'

export const metadata = { title: 'Đăng nhập · Đà Lạt Cafe' }

const notices: Record<string, string> = {
  backend_down: 'Máy chủ đăng nhập (Java) không phản hồi. Vui lòng thử lại sau.',
  disabled: 'Tài khoản đã bị khoá. Liên hệ quản trị viên.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
        Chào mừng trở lại <span className="sr-only">Sign in</span>
      </h1>
      <p className="mt-1 mb-6 text-sm text-stone-600">Nhân viên và khách hàng dùng chung một trang đăng nhập.</p>
      <LoginForm next={safeNext(next) ?? ''} notice={error ? notices[error] : undefined} />
    </>
  )
}
