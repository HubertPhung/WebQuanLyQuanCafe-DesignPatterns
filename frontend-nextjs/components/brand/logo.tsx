import { useId } from 'react'
import { cn } from '@/lib/utils'

// Biểu tượng Đà Lạt Cafe: dãy Langbiang nhô lên từ một ly cà phê ("cà phê cao nguyên") trên huy
// hiệu màu espresso. Vẽ trên lưới 40 đơn vị để luôn sắc nét từ favicon 20px tới 64px.
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    // rounded-[27.5%] khớp góc bo của huy hiệu (rx 11 trên 40), để bóng hay viền mà nơi gọi thêm
    // vào đi theo huy hiệu thay vì vẽ một hộp vuông quanh nó.
    <svg viewBox="0 0 40 40" className={cn('size-10 shrink-0 rounded-[27.5%]', className)} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`${id}-bg`} x1="6" y1="2" x2="34" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6B4632" />
          <stop offset="1" stopColor="#2B1B14" />
        </linearGradient>
        <linearGradient id={`${id}-ridge`} x1="20" y1="9" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FCD34D" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${id}-bg)`} />
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="10.25" fill="none" stroke="#FFFFFF" strokeOpacity="0.12" strokeWidth="1.5" />
      {/* Dãy núi: một đỉnh cao và một sườn thấp, nằm trên miệng ly */}
      <path d="M8.5 22 L15.5 12.5 L19 17 L23.5 9.5 L31.5 22 Z" fill={`url(#${id}-ridge)`} />
      <path d="M21.2 13.3 L23.5 9.5 L25.8 13.3 L24.3 12.6 L23.5 13.6 L22.7 12.6 Z" fill="#FFFBEB" />
      {/* Ly cà phê */}
      <path d="M8.5 22 H31.5 V23.5 C31.5 28.8 26.9 32 20 32 C13.1 32 8.5 28.8 8.5 23.5 Z" fill="#FEF3C7" />
      <path d="M31.2 23.6 H32.6 C34.8 23.6 34.8 28 32.4 28 H30.3" fill="none" stroke="#FEF3C7" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 35 H29" stroke="#FEF3C7" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

type LogoProps = {
  className?: string
  markClassName?: string
  /** Chữ "dark" cho nền sáng, chữ "light" cho nền tối. */
  tone?: 'dark' | 'light'
  tagline?: string | null
}

export function Logo({ className, markClassName, tone = 'dark', tagline = 'Cà phê cao nguyên' }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={markClassName} />
      <span className="flex flex-col leading-none">
        <span className={cn('text-lg font-extrabold tracking-tight', tone === 'dark' ? 'text-[#2B1B14]' : 'text-amber-50')}>
          Đà Lạt <span className={tone === 'dark' ? 'text-[#B45309]' : 'text-amber-300'}>Cafe</span>
        </span>
        {tagline && (
          <span
            className={cn(
              'mt-1 text-[10px] font-bold uppercase tracking-[0.18em]',
              tone === 'dark' ? 'text-stone-500' : 'text-amber-100/70',
            )}
          >
            {tagline}
          </span>
        )}
      </span>
    </span>
  )
}
