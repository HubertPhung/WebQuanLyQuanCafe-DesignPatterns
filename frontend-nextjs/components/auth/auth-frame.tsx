'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { CalendarCheck, Gift, Receipt } from 'lucide-react'
import { Logo } from '@/components/brand/logo'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

// Pointer effects (tilt, spotlight, parallax) only make sense with a mouse or trackpad.
function useFinePointer() {
  const [fine, setFine] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)')
    setFine(query.matches)
    const onChange = (event: MediaQueryListEvent) => setFine(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return fine
}

// ---------------------------------------------------------------- brand panel

/** Slow drifting colour fields ("aurora") behind the brand panel. Transform-only animation. */
function Aurora() {
  const blobs = [
    { className: 'left-[-15%] top-[-10%] size-[70%] bg-[#B45309]/45', x: [0, 60, -20, 0], y: [0, 40, 80, 0], duration: 22 },
    { className: 'right-[-20%] top-[20%] size-[65%] bg-[#D97706]/30', x: [0, -70, 10, 0], y: [0, 50, -30, 0], duration: 26 },
    { className: 'bottom-[-25%] left-[10%] size-[75%] bg-[#7C2D12]/50', x: [0, 40, -50, 0], y: [0, -60, -10, 0], duration: 30 },
  ]
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {blobs.map((blob) => (
        <motion.div
          key={blob.className}
          className={`absolute rounded-full blur-3xl will-change-transform ${blob.className}`}
          animate={{ x: blob.x, y: blob.y, scale: [1, 1.12, 0.95, 1] }}
          transition={{ duration: blob.duration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

// Fixed positions (no Math.random) so server and client render the same markup.
const beans = [
  { left: '8%', top: '18%', size: 22, depth: 0.6, rotate: -20, delay: 0 },
  { left: '78%', top: '12%', size: 30, depth: 1, rotate: 35, delay: 1.2 },
  { left: '62%', top: '38%', size: 16, depth: 0.4, rotate: 10, delay: 2.1 },
  { left: '18%', top: '62%', size: 26, depth: 0.9, rotate: 60, delay: 0.6 },
  { left: '86%', top: '70%', size: 20, depth: 0.5, rotate: -45, delay: 1.8 },
  { left: '44%', top: '84%', size: 14, depth: 0.3, rotate: 80, delay: 2.6 },
  { left: '34%', top: '8%', size: 12, depth: 0.25, rotate: -70, delay: 3.1 },
]

function Bean({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 32" width={size} height={size * 1.33} aria-hidden="true">
      <ellipse cx="12" cy="16" rx="11" ry="15" fill="#6B3F24" />
      <ellipse cx="12" cy="16" rx="11" ry="15" fill="url(#bean-shine)" />
      <path d="M12 2.5c-3.5 5-3.5 9 0 13.5s3.5 8.5 0 13.5" fill="none" stroke="#2B1B14" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ParallaxBean({
  bean,
  mouseX,
  mouseY,
}: {
  bean: (typeof beans)[number]
  mouseX: MotionValue<number>
  mouseY: MotionValue<number>
}) {
  // Nearer beans (higher depth) move further with the pointer, which reads as depth.
  const x = useTransform(mouseX, (value) => value * 36 * bean.depth)
  const y = useTransform(mouseY, (value) => value * 36 * bean.depth)
  return (
    <motion.div className="absolute" style={{ left: bean.left, top: bean.top, x, y, opacity: 0.35 + bean.depth * 0.5 }}>
      <motion.div
        animate={{ y: [0, -14, 0], rotate: [bean.rotate, bean.rotate + 18, bean.rotate] }}
        transition={{ duration: 6 + bean.depth * 4, repeat: Infinity, ease: 'easeInOut', delay: bean.delay }}
        style={{ filter: bean.depth < 0.45 ? 'blur(1.5px)' : undefined }}
      >
        <Bean size={bean.size} />
      </motion.div>
    </motion.div>
  )
}

function FloatingBeans({ mouseX, mouseY }: { mouseX: MotionValue<number>; mouseY: MotionValue<number> }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <svg width="0" height="0" className="absolute">
        <defs>
          <radialGradient id="bean-shine" cx="35%" cy="30%" r="70%">
            <stop offset="0" stopColor="#FCD34D" stopOpacity="0.35" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      {beans.map((bean) => (
        <ParallaxBean key={`${bean.left}-${bean.top}`} bean={bean} mouseX={mouseX} mouseY={mouseY} />
      ))}
    </div>
  )
}

const rotatingWords = ['từng tách cà phê', 'mỗi buổi sáng', 'những cuộc hẹn']

/** Words blur into focus one by one; the last phrase cycles. */
function Headline() {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (reduce) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % rotatingWords.length), 2800)
    return () => window.clearInterval(timer)
  }, [reduce])
  const words = 'Hương vị cao nguyên trong'.split(' ')
  return (
    <h2 className="font-display mt-5 text-[2.6rem] font-semibold leading-[1.18] text-amber-50 xl:text-5xl">
      <span className="sr-only">Hương vị cao nguyên trong từng tách cà phê.</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <motion.span
            key={word}
            className="mr-[0.28em] inline-block"
            initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, delay: 0.15 + i * 0.08, ease: EASE_OUT }}
          >
            {word}
          </motion.span>
        ))}
        <span className="relative block h-[1.3em] overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.em
              key={rotatingWords[index]}
              className="absolute left-0 top-0 whitespace-nowrap bg-gradient-to-r from-amber-200 via-amber-300 to-orange-300 bg-clip-text italic text-transparent"
              initial={{ y: '100%', opacity: 0, filter: 'blur(6px)' }}
              animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
              exit={{ y: '-100%', opacity: 0, filter: 'blur(6px)', transition: { duration: 0.25 } }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            >
              {rotatingWords[index]}.
            </motion.em>
          </AnimatePresence>
        </span>
      </span>
    </h2>
  )
}

const perks = [
  { icon: Gift, text: 'Tích điểm mỗi đơn, đổi điểm trừ thẳng vào hoá đơn' },
  { icon: CalendarCheck, text: 'Đặt bàn trước, giữ chỗ khung giờ yêu thích' },
  { icon: Receipt, text: 'Xem lại lịch sử đơn và voucher của bạn' },
]

function BrandPanel() {
  const fine = useFinePointer()
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const smoothX = useSpring(mouseX, { stiffness: 60, damping: 20 })
  const smoothY = useSpring(mouseY, { stiffness: 60, damping: 20 })

  function track(event: React.PointerEvent<HTMLElement>) {
    if (!fine) return
    const rect = event.currentTarget.getBoundingClientRect()
    mouseX.set((event.clientX - rect.left) / rect.width - 0.5)
    mouseY.set((event.clientY - rect.top) / rect.height - 0.5)
  }

  return (
    <aside
      onPointerMove={track}
      onPointerLeave={() => {
        mouseX.set(0)
        mouseY.set(0)
      }}
      className="relative hidden overflow-hidden bg-[#1F130D] text-amber-50 lg:flex lg:flex-col lg:justify-between lg:p-12"
    >
      <Image src="/images/space/garden.jpg" alt="" fill priority sizes="50vw" className="object-cover opacity-20 mix-blend-luminosity" />
      <Aurora />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,transparent_20%,#1F130D_75%)]" aria-hidden="true" />
      <FloatingBeans mouseX={smoothX} mouseY={smoothY} />

      <Link href="/" aria-label="Đà Lạt Cafe – trang chủ" className="relative w-fit rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
        <Logo tone="light" markClassName="size-11 shadow-[0_6px_18px_rgba(0,0,0,0.35)]" />
      </Link>

      <div className="relative max-w-md">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="inline-flex items-center gap-2 rounded-full border border-amber-50/15 bg-amber-50/5 px-3 py-1 text-xs font-semibold tracking-wide text-amber-100/90 backdrop-blur"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          Mở cửa 07:00 – 22:00 mỗi ngày
        </motion.span>
        <Headline />
        <motion.ul
          initial="hidden"
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: 0.09, delayChildren: 0.6 } } }}
          className="mt-8 space-y-3"
        >
          {perks.map(({ icon: Icon, text }) => (
            <motion.li
              key={text}
              variants={{ hidden: { opacity: 0, x: -16 }, shown: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE_OUT } } }}
              className="flex items-center gap-3 rounded-xl border border-amber-50/10 bg-amber-50/[0.04] px-3 py-2.5 text-sm text-amber-50/90 backdrop-blur-sm"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-300/25 to-orange-500/10 ring-1 ring-amber-200/20">
                <Icon className="size-4 text-amber-200" aria-hidden="true" />
              </span>
              {text}
            </motion.li>
          ))}
        </motion.ul>
      </div>

      <p className="relative text-xs text-amber-50/55">Phường Cam Ly, TP. Đà Lạt · Hotline 0988 752 291</p>
    </aside>
  )
}

// ---------------------------------------------------------------- form side

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
    <nav aria-label="Chọn đăng nhập hoặc tạo tài khoản" className="relative grid grid-cols-2 rounded-xl bg-stone-200/60 p-1 backdrop-blur">
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

/**
 * The form card: tilts toward the pointer, a soft spotlight follows it, and a light beam runs
 * around the border. Flips in when switching between sign-in and sign-up.
 */
function SpotlightCard({ children, flipKey }: { children: React.ReactNode; flipKey: string }) {
  const fine = useFinePointer()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const pointerX = useMotionValue(50)
  const pointerY = useMotionValue(50)
  const tiltX = useSpring(0, { stiffness: 160, damping: 18 })
  const tiltY = useSpring(0, { stiffness: 160, damping: 18 })
  const spotlight = useMotionTemplate`radial-gradient(420px circle at ${pointerX}% ${pointerY}%, rgba(217,119,6,0.10), transparent 60%)`

  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (!fine || reduce || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    pointerX.set(px * 100)
    pointerY.set(py * 100)
    tiltX.set((0.5 - py) * 6)
    tiltY.set((px - 0.5) * 6)
  }

  function leave() {
    tiltX.set(0)
    tiltY.set(0)
  }

  return (
    <div className="mt-6 [perspective:1200px]">
      <motion.div
        key={flipKey}
        initial={{ opacity: 0, rotateY: -14, y: 18, filter: 'blur(6px)' }}
        animate={{ opacity: 1, rotateY: 0, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        <motion.div
          ref={ref}
          onPointerMove={move}
          onPointerLeave={leave}
          style={{ rotateX: tiltX, rotateY: tiltY, transformStyle: 'preserve-3d' }}
          className="relative overflow-hidden rounded-2xl p-[1.5px] shadow-[0_24px_60px_-20px_rgba(62,39,35,0.35)]"
        >
          {/* Border beam: a conic gradient spinning behind a 1.5px gap */}
          <div className="absolute inset-0 rounded-2xl bg-stone-200/80" aria-hidden="true" />
          <motion.div
            aria-hidden="true"
            className="absolute -inset-[60%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_250deg,#F59E0B_300deg,#FDE68A_330deg,transparent_360deg)]"
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          />
          <div className="relative rounded-[15px] bg-white p-6 sm:p-8">
            <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[15px]" style={{ background: spotlight }} />
            <div className="relative">{children}</div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export function AuthFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    // "user": honours prefers-reduced-motion for every framer-motion animation below.
    <MotionConfig reducedMotion="user">
      <div className="grid min-h-svh bg-[#F7F5F0] text-stone-900 lg:grid-cols-2">
        <BrandPanel />
        <main className="relative flex flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-8">
          {/* Dotted texture and a warm glow keep the form side from feeling flat */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(#3E2723_1px,transparent_1px)] [background-size:22px_22px] opacity-[0.06]"
          />
          <div aria-hidden="true" className="pointer-events-none absolute -top-40 right-[-20%] size-[520px] rounded-full bg-amber-400/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 left-[-25%] size-[520px] rounded-full bg-orange-300/15 blur-3xl" />

          <Link href="/" aria-label="Đà Lạt Cafe – trang chủ" className="relative mb-8 lg:hidden">
            <Logo />
          </Link>
          <div className="relative w-full max-w-[440px]">
            <ModeSwitch />
            <SpotlightCard flipKey={pathname}>{children}</SpotlightCard>
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
