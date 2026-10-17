import { GoogleSignIn, RegisterForm } from '@/components/auth/auth-forms'
import { googleConfig } from '@/lib/auth/google'
import { safeNext } from '@/lib/auth/roles'

export const metadata = { title: 'Tạo tài khoản · Đà Lạt Cafe' }

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
        Tạo tài khoản <span className="sr-only">Create account</span>
      </h1>
      <p className="mt-1 mb-6 text-sm text-stone-600">Tích điểm, đặt bàn và theo dõi đơn của bạn ở một nơi.</p>
      <GoogleSignIn next={safeNext(next) ?? ''} enabled={googleConfig() !== null} />
      <RegisterForm next={safeNext(next) ?? ''} />
    </>
  )
}
