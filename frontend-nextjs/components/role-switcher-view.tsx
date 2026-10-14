'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import {
  ArrowRight,
  Bean,
  Coffee,
  Leaf,
  Truck,
} from 'lucide-react'
import type { Product, Cart, Money } from '@/lib/shopify'
import type { FloorTable, Order } from '@/lib/db/schema'
import { CoffeeFooter } from '@/components/coffee-footer'
import { Hero } from '@/components/storefront/Hero'
import { DrinkMenu } from '@/components/storefront/DrinkMenu'
import { Header } from '@/components/storefront/Header'
import { useCartStore } from '@/lib/store/cart-store'
import { toast } from 'sonner'

interface RoleSwitcherViewProps {
  products: Product[]
  catalogError?: string
  storeDomain?: string
  initialOverview?: {
    metrics: any
    revenueByDay: any[]
    topDrinks: any[]
    recentOrders: Order[]
  }
  initialTables?: FloorTable[]
}

const fetcher = async (url: string) => {
  const r = await fetch(url)
  const d = await r.json()
  if (!r.ok) throw new Error(d.error)
  return d
}

export function RoleSwitcherView({
  products,
  catalogError,
  storeDomain,
}: RoleSwitcherViewProps) {
  const { data: cart, mutate: mutateCart } = useSWR<Cart | null>('/api/cart', fetcher)
  const { data: favorites = [], mutate: mutateFavorites } = useSWR<string[]>('/api/favorites', fetcher)

  // Sync SWR cart to Zustand global store
  useEffect(() => {
    if (cart) {
      useCartStore.getState().setCart(cart)
    }
  }, [cart])

  const handleToggleFavorite = async (productId: string) => {
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId }),
      })
      if (!res.ok) throw new Error('Không thể lưu mục yêu thích')
      const data = await res.json()
      await mutateFavorites(data, false)
      if (data.includes(productId)) {
        toast.success('Đã lưu vào danh sách yêu thích!')
      } else {
        toast.info('Đã bỏ lưu món khỏi mục yêu thích.')
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleAddToCart = async (product: Product, options: Record<string, string>, variantId: string) => {
    const success = await useCartStore.getState().addToCart(product, variantId, options)
    if (success) {
      mutateCart()
      return true
    }
    return false
  }

  return (
    <div className="bg-[#FAF8F5] text-stone-900 min-h-screen selection:bg-amber-100 selection:text-amber-900 font-sans">
      {/* 1. DEDICATED CUSTOMER STOREFRONT */}
      <main className="min-h-screen">
        {/* Modular Sticky Header with AccountDropdown & CartSheet */}
        <Header favoritesCount={favorites.length} />

        {/* Hero Section Component */}
        <Hero
          onBrowseBeans={() => {
            const el = document.getElementById('menu')
            el?.scrollIntoView({ behavior: 'smooth' })
          }}
        />

        {/* Brand Values Strip */}
        <section className="values-strip" aria-label="Giá trị cốt lõi cà phê Đà Lạt Cafe">
          <span>
            <Bean />
            Nguồn hạt đạo đức, tuyển chọn
          </span>
          <span>
            <Coffee />
            Rang mộc tươi mới mỗi ngày
          </span>
          <span>
            <Leaf />
            Chăm chút tỉ mỉ từng mẻ rang
          </span>
          <span>
            <Truck />
            Giao tận tay ly cà phê thơm
          </span>
        </section>

        {/* Menu Catalog Component */}
        <DrinkMenu
          products={products}
          catalogError={catalogError}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          onAddToCart={handleAddToCart}
        />

        {/* Whole Bean Feature Showcase */}
        {products
          .filter((p) => p.productType === 'Whole Bean')
          .map((p) => (
            <section className="bean-feature section-shell" key={p.id}>
              <div>
                <p className="eyebrow">TỪ XƯỞNG RANG ĐẾN TÁCH CÀ PHÊ CỦA BẠN</p>
                <h2>
                  Góc quán quen thuộc yêu thích.
                  <br />
                  Nay hiện diện ngay gian bếp của bạn.
                </h2>
                <p>{p.description}</p>
                <a href="#menu" className="primary-link">
                  Khám phá {p.title} <ArrowRight size={16} />
                </a>
              </div>
              {p.featuredImage && <img src={p.featuredImage.url} alt={p.title} loading="lazy" />}
            </section>
          ))}

        {/* Coffee Story Section */}
        <section className="story-section section-shell" id="story">
          <div className="story-image">
            <img src="/images/hero.png" alt="Tách cà phê ấm áp, được chế tác từ tâm" loading="lazy" />
            <span>HƠN CẢ MỘT TÁCH CÀ PHÊ.</span>
          </div>
          <div className="story-copy">
            <p className="eyebrow">KHỞI NGUỒN TỪ TÂM. CHẾ TÁC TỪ THỦ CÔNG.</p>
            <h2>
              Cà phê hảo hạng.
              <br />
              Những khoảnh khắc đáng nhớ.
            </h2>
            <p>
              Chúng tôi tin rằng những điều tuyệt vời nhất trong cuộc sống không bao giờ vội vã. Một cuộc trò chuyện lắng đọng. Một buổi sáng bình yên. Một tách cà phê được pha chế riêng cho bạn.
            </p>
            <p>
              Đó là tinh thần đằng sau Đà Lạt Cafe. Những hạt cà phê được tuyển chọn tỉ mỉ, rang xay bằng cả tâm huyết và tình yêu gắn kết mọi người lại gần nhau hơn.
            </p>
            <a href="#menu" className="text-link">
              Khám phá phong vị buổi sáng của bạn <ArrowRight size={16} />
            </a>
          </div>
        </section>

        {/* Educational Coffee Journal Section */}
        <section id="journal" className="journal section-shell">
          <p className="eyebrow">
            GÓC CHUYỆN CÀ PHÊ <span className="sr-only">NOTES FROM THE COFFEE BAR</span>
          </p>
          <h2>Hành trình cho một tách cà phê trọn vị.</h2>
          <div className="journal-grid">
            {[
              {
                title: 'Nghệ thuật pha Pour-over buổi sáng',
                body: 'Bắt đầu với hạt cà phê mới xay và nước sôi vừa hạ nhiệt. Làm ẩm bột cà phê, để nở trong 30 giây rồi rót nước chậm rãi theo vòng xoắn. Một chút kiên nhẫn tạo nên sự khác biệt tuyệt vời.',
              },
              {
                title: 'Bảo quản hạt cà phê luôn tươi mới',
                body: 'Bảo quản hạt nguyên trong hộp kín khí, tránh xa nhiệt độ cao và ánh nắng trực tiếp. Chỉ xay lượng vừa đủ ngay trước khi pha để giữ trọn vẹn hương vị đặc trưng.',
              },
              {
                title: 'Chọn mức độ rang phù hợp gu của bạn',
                body: 'Rang sáng (Light) mang nốt hương thanh tao, hoa quả. Rang vừa (Medium) cân bằng vị ngọt và độ đậm. Rang đậm (Dark) nồng nàn và sánh mịn. Không có lựa chọn sai—chỉ có hương vị bạn yêu thích nhất.',
              },
            ].map((a, i) => (
              <article key={a.title}>
                <span>0{i + 1} / THÓI QUEN MỖI NGÀY</span>
                <h3>{a.title}</h3>
                <p>{a.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Footer Component */}
        <CoffeeFooter storeDomain={storeDomain} />
      </main>
    </div>
  )
}
export default RoleSwitcherView

