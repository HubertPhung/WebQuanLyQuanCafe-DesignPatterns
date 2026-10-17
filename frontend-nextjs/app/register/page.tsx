import { AuthShell, Divider } from '@/components/auth/auth-shell'
import { GoogleButton, RegisterForm } from '@/components/auth/auth-forms'
import { googleConfig } from '@/lib/auth/google'
import { safeNext } from '@/lib/auth/roles'

export const metadata = { title: 'Tạo tài khoản · Đà Lạt Cafe' }

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const target = safeNext(next) ?? ''
  return (
    <AuthShell
      title="Tạo tài khoản"
      description="Tài khoản mới là tài khoản khách hàng. Tài khoản nhân viên do quản trị viên cấp."
    >
      <span className="sr-only">Create account</span>
      <GoogleButton next={target} enabled={googleConfig() !== null} />
      <Divider />
      <RegisterForm next={target} />
    </AuthShell>
  )
}
