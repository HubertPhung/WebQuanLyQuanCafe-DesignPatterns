import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

// Frame of the account security page (sign-in and sign-up use the animated AuthFrame).
export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#F7F5F0] px-4 py-10 text-stone-900">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="Đà Lạt Cafe – trang chủ" className="mb-6 flex justify-center">
          <Logo />
        </Link>
        <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-[0_8px_30px_rgba(62,39,35,0.06)] sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-stone-600">{description}</p>
          {children}
        </div>
      </div>
    </main>
  )
}
