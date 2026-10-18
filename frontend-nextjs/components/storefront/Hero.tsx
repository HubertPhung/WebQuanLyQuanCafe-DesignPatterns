'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Bean, Sparkles, CalendarCheck } from 'lucide-react'
import { useReservationStore } from '@/lib/store/reservation-store'

interface HeroProps {
  onBrowseBeans?: () => void
  onOpenReservation?: () => void
}

export function Hero({ onBrowseBeans, onOpenReservation }: HeroProps) {
  const handleOpenReservation = () => {
    if (onOpenReservation) {
      onOpenReservation()
    } else {
      useReservationStore.getState().openReservation()
    }
  }

  const handleBrowseBeans = () => {
    if (onBrowseBeans) {
      onBrowseBeans()
    } else {
      const el = document.getElementById('menu')
      if (el) {
        const headerOffset = 88
        const elementPosition = el.getBoundingClientRect().top
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset
        window.scrollTo({ top: Math.max(0, offsetPosition), behavior: 'smooth' })
      }
    }
  }

  return (
    <section
      id="hero"
      className="hero relative overflow-hidden bg-gradient-to-br from-[#FAF8F5] via-[#F5EFE6] to-[#FAF8F5] text-stone-900 border-b border-stone-200/80 scroll-mt-24 lg:min-h-[calc(100vh-106px)] lg:max-h-[850px]"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="hero-copy p-6 sm:p-8 md:p-10 lg:px-12 lg:py-8 xl:px-16 xl:py-10 flex flex-col justify-center h-full"
      >
        <p className="eyebrow inline-flex items-center gap-2 text-xs md:text-sm font-semibold uppercase tracking-wider text-[#C88A58]">
          <span className="size-2 rounded-full bg-[#C88A58] animate-pulse" />
          Thủ công từ tâm · TẬN TÂM TỪNG MẺ RANG
        </p>

        <h1 className="font-display my-2.5 sm:my-3.5 lg:my-3 text-3xl sm:text-4xl md:text-5xl lg:text-[2.65rem] xl:text-[3.25rem] font-semibold text-stone-900 leading-[1.18] text-balance">
          Cà phê thủ công,<br />
          chế tác cho<br />
          <em className="font-display text-[#B4703F] italic font-medium">tâm hồn bạn.</em>
          <span className="sr-only">Artisan coffee</span>
        </h1>

        <p className="hero-description text-sm sm:text-base leading-relaxed text-stone-600 max-w-lg">
          Từng giọt cà phê chắt lọc tinh hoa từ những hạt Arabica tuyển chọn. Mỗi tách cà phê là một khoảng lặng trọn vẹn trong ngày dài hối hả.
        </p>

        <div className="hero-ctas mt-4 sm:mt-5 lg:mt-5 flex flex-wrap items-center gap-3.5 text-sm md:text-base font-semibold">
          <a
            href="#menu"
            className="primary-link h-11 sm:h-12 px-5 sm:px-6 inline-flex items-center justify-center gap-3 rounded-xl bg-[#3E2723] text-white shadow-md transition-all duration-200 hover:bg-[#2c1b18] hover:shadow-lg active:scale-95"
          >
            <span>Tìm món yêu thích</span>
            <span className="sr-only">Find your cup</span>
            <ArrowRight className="size-4.5" />
          </a>

          <button
            type="button"
            onClick={handleOpenReservation}
            className="group h-11 sm:h-12 px-5 sm:px-6 inline-flex items-center justify-center gap-2.5 rounded-xl border border-stone-300 bg-white text-stone-800 shadow-2xs transition-all duration-200 hover:border-[#3E2723] hover:bg-stone-50 hover:text-[#3E2723] active:scale-95 cursor-pointer"
          >
            <CalendarCheck className="size-4 text-[#B45309] shrink-0 transition-transform duration-200 group-hover:scale-110" />
            <span className="font-semibold text-stone-800 group-hover:text-[#3E2723] transition-colors leading-none">
              Đặt bàn trực tuyến
            </span>
            <span className="sr-only">Explore our beans</span>
            <ArrowRight className="size-4 text-[#B45309] shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="hero-foot mt-5 sm:mt-6 lg:mt-5 xl:mt-6 flex items-center gap-3.5 border-t border-stone-200/60 pt-3.5 sm:pt-4">
          <div className="small-beans flex -space-x-1.5">
            <span className="inline-flex size-8.5 items-center justify-center rounded-full border-2 border-white bg-[#f5efe6] text-[#3E2723] shadow-xs">
              <Bean className="size-4" />
            </span>
            <span className="inline-flex size-8.5 items-center justify-center rounded-full border-2 border-white bg-[#e7ddd0] text-[#3E2723] shadow-xs">
              <Bean className="size-4" />
            </span>
            <span className="inline-flex size-8.5 items-center justify-center rounded-full border-2 border-white bg-[#3E2723] text-amber-300 shadow-xs">
              <Sparkles className="size-4" />
            </span>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-stone-900 leading-snug">Hương vị chuẩn gu, ấm áp từng khoảnh khắc</p>
            <small className="block text-[11px] sm:text-xs text-stone-500 font-medium">Khoảnh khắc thường nhật, thêm phần trọn vẹn đặc biệt.</small>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
        className="hero-visual relative h-full min-h-[380px] md:min-h-[460px] lg:min-h-0"
      >
        <img
          src="/images/hero.png"
          alt="Tách cà phê thủ công latte nghệ thuật bọt sữa trên bàn gỗ"
          fetchPriority="high"
          className="h-full w-full object-cover object-[57%_center]"
        />

        <div className="arabica-seal absolute top-6 right-6 flex size-26 sm:size-28 flex-col items-center justify-center rounded-full border border-amber-200/60 bg-stone-900/40 p-2 text-center text-amber-100 backdrop-blur-md outline outline-1 outline-offset-[-6px] outline-amber-200/40 rotate-12 shadow-lg">
          <Bean className="size-5 sm:size-6 mb-0.5 text-amber-300" strokeWidth={1.5} />
          <strong className="text-[9px] sm:text-[10px] font-bold tracking-wider leading-tight">100% ARABICA</strong>
          <span className="text-[6.5px] sm:text-[7px] tracking-widest uppercase text-amber-200">CÀ PHÊ ĐẶC SẢN</span>
        </div>

        <div className="photo-caption absolute bottom-4 left-4 sm:bottom-6 sm:left-6 pointer-events-none select-none">
          <span className="text-[11px] sm:text-xs font-semibold tracking-[0.18em] uppercase text-amber-100/95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
            TẬN TÂM CHẾ TÁC, MỌI LÚC MỌI NƠI.
          </span>
        </div>
      </motion.div>
    </section>
  )
}
export default Hero
