'use client'

import { localImageSrc } from '@/lib/assets'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Armchair, Leaf, Sun } from 'lucide-react'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

// Photos: Unsplash License (free to use). Self-hosted in /public/images/space.
const photos = [
  {
    src: '/images/space/garden.jpg',
    alt: 'Khu ngồi ghế gỗ bên cửa kính lớn nhìn ra khu vườn xanh',
    caption: 'Tầng trệt nhìn ra vườn',
    credit: 'Thomas Hoang',
    className: 'md:col-span-2 md:row-span-2 aspect-[4/3] md:aspect-auto',
  },
  {
    src: '/images/space/counter.jpg',
    alt: 'Quầy bar với đèn thả ấm áp, kệ gỗ và tủ bánh',
    caption: 'Quầy bar thủ công',
    credit: 'Miruthula Adiyamane',
    className: 'aspect-[4/3] md:aspect-auto',
  },
  {
    src: '/images/space/lounge.jpg',
    alt: 'Góc bàn gỗ yên tĩnh cạnh cửa sổ, cây treo và bảng thực đơn',
    caption: 'Góc yên tĩnh bên cửa sổ',
    credit: 'Haberdoedas',
    className: 'aspect-[4/3] md:aspect-auto',
  },
]

const highlights = [
  { icon: Sun, title: 'Nắng sớm cao nguyên', text: 'Cửa kính lớn đón nắng buổi sáng, lý tưởng cho một ly pour-over chậm rãi.' },
  { icon: Leaf, title: 'Xanh mát quanh năm', text: 'Cây xanh và khoảng vườn nhỏ giữ không khí dịu nhẹ đặc trưng Đà Lạt.' },
  { icon: Armchair, title: 'Ngồi lâu cũng thoải mái', text: 'Ghế gỗ êm, bàn rộng cho nhóm bạn, và những góc riêng để đọc sách hay làm việc.' },
]

// "Góc cà phê": an introduction to the shop's space, revealed as it scrolls into view.
export function CafeSpace() {
  return (
    <div className="mt-8">
      <div className="grid gap-4 md:h-[520px] md:grid-cols-3 md:grid-rows-2">
        {photos.map((photo, index) => (
          <motion.figure
            key={photo.src}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: index * 0.1, ease: EASE_OUT }}
            className={`group relative overflow-hidden rounded-2xl bg-stone-200 ${photo.className}`}
          >
            <Image
              src={localImageSrc(photo.src)}
              alt={photo.alt}
              fill
              sizes={index === 0 ? '(min-width: 768px) 66vw, 100vw' : '(min-width: 768px) 33vw, 100vw'}
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#2B1B14]/75 via-[#2B1B14]/10 to-transparent" />
            <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-amber-50">
              <span className="font-display text-lg font-semibold leading-tight md:text-xl">{photo.caption}</span>
              <span className="shrink-0 text-[10px] text-amber-50/70">Ảnh: {photo.credit} / Unsplash</span>
            </figcaption>
          </motion.figure>
        ))}
      </div>

      <ul className="mt-8 grid gap-6 md:grid-cols-3">
        {highlights.map(({ icon: Icon, title, text }, index) => (
          <motion.li
            key={title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: index * 0.08, ease: EASE_OUT }}
            className="flex gap-3"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#3E2723]/8 text-[#5A3E2B]">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-stone-900">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">{text}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
