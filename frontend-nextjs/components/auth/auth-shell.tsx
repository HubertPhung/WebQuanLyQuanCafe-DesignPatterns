import Link from 'next/link'
import { Coffee } from 'lucide-react'

// Shared frame of the sign-in, sign-up and account pages.
export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#F7F5F0] px-4 py-10 text-stone-900">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-[#5A3E2B]">
          <Coffee className="size-6" aria-hidden="true" />
          <span className="text-lg font-extrabold tracking-tight">Đà Lạt Cafe</span>
        </Link>
        <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-stone-600">{description}</p>
          {children}
        </div>
      </div>
    </main>
  )
}

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-stone-400">
      <span className="h-px flex-1 bg-stone-200" />
      hoặc
      <span className="h-px flex-1 bg-stone-200" />
    </div>
  )
}
