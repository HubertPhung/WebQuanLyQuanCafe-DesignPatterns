'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { CalendarCheck, Gift, Receipt } from 'lucide-react'
import { Logo } from '@/components/brand/logo'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

const perks = [
  { icon: Gift, text: 'Tích điểm mỗi đơn, đổi điểm trừ thẳng vào hoá đơn' },
  { icon: CalendarCheck, text: 'Đặt bàn trước, giữ chỗ khung giờ yêu thích' },
  { icon: Receipt, text: 'Xem lại lịch sử đơn và voucher của bạn' },
]

// Three wisps rising over the cup. Decorative only, and frozen when reduced motion is on.
function Steam() {
  const reduce = useReducedMotion()
  const wisps = ['M20 60 C 10 45, 30 35, 20 20 S 25 5, 20 0', 'M40 60 C 30 45, 50 35, 40 20 S 45 5, 40 0', 'M60 60 C 50 45, 70 35, 60 20 S 65 5, 60 0']
  return (
    <svg viewBox="0 0 80 60" className="h-16 w-20 text-amber-100/80" aria-hidden="true">
      {wisps.map((d, index) => (
        <motion.path
          key={d}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ opacity: 0, y: 8 }}
          animate={reduce ? { opacity: 0.6, y: 0 } : { opacity: [0, 0.75, 0], y: [8, -6, -14] }}
          transition={reduce ? { duration: 0 } : { duration: 3.2, repeat: Infinity, delay: index * 0.9, ease: 'easeInOut' }}
        />
      ))}
    </svg>
  )
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[#2B1B14] text-amber-50 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <Image src="/images/hero.png" alt="" fill priority sizes="50vw" className="object-cover opacity-35" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#2B1B14]/95 via-[#3E2723]/80 to-[#5A3E2B]/70" aria-hidden="true" />

      <Link href="/" aria-label="Đà Lạt Cafe – trang chủ" className="relative w-fit rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
        <Logo tone="light" markClassName="size-11 shadow-[0_6px_18px_rgba(0,0,0,0.35)]" />
      </Link>

      <div className="relative max-w-md">
        <Steam />
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-balance"
        >
          Hương vị cao nguyên trong từng tách cà phê.
        </motion.h2>
        <motion.ul
          initial="hidden"
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } } }}
          className="mt-8 space-y-4"
        >
          {perks.map(({ icon: Icon, text }) => (
            <motion.li
              key={text}
              variants={{ hidden: { opacity: 0, x: -12 }, shown: { opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE_OUT } } }}
              className="flex items-center gap-3 text-sm text-amber-50/90"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50/10 ring-1 ring-amber-50/15">
                <Icon className="size-4 text-amber-200" aria-hidden="true" />
              </span>
              {text}
            </motion.li>
          ))}
        </motion.ul>
      </div>

      <p className="relative text-xs text-amber-50/60">Phường Cam Ly, TP. Đà Lạt · Mở cửa 07:00 – 22:00</p>
    </aside>
  )
}

const tabs = [
  { href: '/login', label: 'Đăng nhập' },
  { href: '/register', label: 'Tạo tài khoản' },
]

// Segmented switch; the pill slides between the two routes because this layout stays mounted.
function ModeSwitch() {
  const pathname = usePathname()
  const next = useSearchParams().get('next')
  const query = next ? `?next=${encodeURIComponent(next)}` : ''
  return (
    <nav aria-label="Chọn đăng nhập hoặc tạo tài khoản" className="relative grid grid-cols-2 rounded-xl bg-stone-200/60 p-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={`${tab.href}${query}`}
            aria-current={active ? 'page' : undefined}
            className={`relative z-10 flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${
              active ? 'text-[#3E2723]' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {active && (
              <motion.span
                layoutId="auth-mode-pill"
                className="absolute inset-0 -z-10 rounded-lg bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AuthFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    // "user": honours prefers-reduced-motion for every animation below.
    <MotionConfig reducedMotion="user">
      <div className="grid min-h-svh bg-[#F7F5F0] text-stone-900 lg:grid-cols-2">
        <BrandPanel />
        <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
          <Link href="/" aria-label="Đà Lạt Cafe – trang chủ" className="mb-8 lg:hidden">
            <Logo />
          </Link>
          <div className="w-full max-w-[420px]">
            <ModeSwitch />
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className="mt-6 rounded-2xl border border-stone-200/90 bg-white p-6 shadow-[0_8px_30px_rgba(62,39,35,0.06)] sm:p-8"
            >
              {children}
            </motion.div>
            <p className="mt-6 text-center text-xs text-stone-500">
              <Link href="/" className="font-semibold text-[#5A3E2B] underline-offset-4 hover:underline">
                ← Về trang đặt món
              </Link>
            </p>
          </div>
        </main>
      </div>
    </MotionConfig>
  )
}
