'use client'

import { motion } from 'framer-motion'
import { ArrowDown, ArrowRight, Bean, Sparkles } from 'lucide-react'

interface HeroProps {
  onBrowseBeans?: () => void
}

export function Hero({ onBrowseBeans }: HeroProps) {
  const handleBrowseBeans = () => {
    if (onBrowseBeans) {
      onBrowseBeans()
    } else {
      const el = document.getElementById('menu')
      el?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section className="hero relative overflow-hidden bg-gradient-to-br from-[#FAF8F5] via-[#F5EFE6] to-[#FAF8F5] text-stone-900 border-b border-stone-200/80">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="hero-copy p-8 md:p-14 lg:p-20 flex flex-col justify-center"
      >
        <p className="eyebrow inline-flex items-center gap-2 text-xs md:text-sm font-semibold uppercase tracking-wider text-[#C88A58]">
          <span className="size-2 rounded-full bg-[#C88A58] animate-pulse" />
          Thủ công từ tâm · TẬN TÂM TỪNG MẺ RANG
        </p>

        <h1 className="my-5 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-stone-900 leading-[1.25] tracking-normal">
          Cà phê thủ công,<br />
          chế tác cho<br />
          <em className="text-[#C88A58] italic font-sans">tâm hồn bạn.</em>
          <span className="sr-only">Artisan coffee</span>
        </h1>

        <p className="hero-description text-base md:text-lg leading-relaxed text-stone-600 max-w-lg">
          Từng giọt cà phê chắt lọc tinh hoa từ những hạt Arabica tuyển chọn. Mỗi tách cà phê là một khoảng lặng trọn vẹn trong ngày dài hối hả.
        </p>

        <div className="hero-ctas mt-8 flex flex-wrap items-center gap-4 text-sm md:text-base font-semibold">
          <a
            href="#menu"
            className="primary-link h-12 px-6 inline-flex items-center justify-center gap-3 rounded-xl bg-[#3E2723] text-white shadow-md transition-all duration-200 hover:bg-[#2c1b18] hover:shadow-lg active:scale-95"
          >
            <span>Tìm món yêu thích</span>
            <span className="sr-only">Find your cup</span>
            <ArrowRight className="size-4.5" />
          </a>

          <button
            type="button"
            onClick={handleBrowseBeans}
            className="secondary-link h-12 px-6 inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white text-stone-800 shadow-xs transition-all hover:bg-stone-50 hover:border-stone-400 active:scale-95"
          >
            <span>Khám phá hạt rang</span>
            <span className="sr-only">Explore our beans</span>
            <ArrowRight className="size-4.5 text-[#C88A58]" />
          </button>
        </div>

        <div className="hero-foot mt-10 flex items-center gap-4 border-t border-stone-200/60 pt-6">
          <div className="small-beans flex -space-x-1.5">
            <span className="inline-flex size-9 items-center justify-center rounded-full border-2 border-white bg-[#f5efe6] text-[#3E2723] shadow-xs">
              <Bean className="size-4.5" />
            </span>
            <span className="inline-flex size-9 items-center justify-center rounded-full border-2 border-white bg-[#e7ddd0] text-[#3E2723] shadow-xs">
              <Bean className="size-4.5" />
            </span>
            <span className="inline-flex size-9 items-center justify-center rounded-full border-2 border-white bg-[#3E2723] text-amber-300 shadow-xs">
              <Sparkles className="size-4.5" />
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-stone-900 leading-snug">Hương vị chuẩn gu, ấm áp từng khoảnh khắc</p>
            <small className="block text-xs text-stone-500 font-medium">Khoảnh khắc thường nhật, thêm phần trọn vẹn đặc biệt.</small>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
        className="hero-visual relative min-h-[440px] md:min-h-[520px]"
      >
        <img
          src="/images/hero.png"
          alt="Tách cà phê thủ công latte nghệ thuật bọt sữa trên bàn gỗ"
          fetchPriority="high"
          className="h-full w-full object-cover object-[57%_center]"
        />

        <div className="arabica-seal absolute top-6 right-6 flex size-28 flex-col items-center justify-center rounded-full border border-amber-200/60 bg-stone-900/40 p-2 text-center text-amber-100 backdrop-blur-md outline outline-1 outline-offset-[-6px] outline-amber-200/40 rotate-12 shadow-lg">
          <Bean className="size-6 mb-0.5 text-amber-300" strokeWidth={1.5} />
          <strong className="text-[10px] font-bold tracking-wider leading-tight">100% ARABICA</strong>
          <span className="text-[7px] tracking-widest uppercase text-amber-200">CÀ PHÊ ĐẶC SẢN</span>
        </div>

        <div className="photo-caption absolute bottom-6 left-6 right-6 flex items-center justify-between text-xs tracking-widest text-white/90 font-semibold bg-stone-950/40 px-4 py-2 rounded-xl backdrop-blur-sm">
          <span>TẬN TÂM CHẾ TÁC, MỌI LÚC MỌI NƠI.</span>
          <ArrowDown className="size-4 text-amber-300 animate-bounce" />
        </div>
      </motion.div>
    </section>
  )
}
export default Hero
