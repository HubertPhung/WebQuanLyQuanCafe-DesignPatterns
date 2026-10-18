'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Coffee, Heart, Plus, Search, SlidersHorizontal, Sparkles, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { Product, Money } from '@/lib/shopify'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { DRINK_TAG } from '@/lib/storefront/product-tags'

interface DrinkMenuProps {
  products: Product[]
  catalogError?: string
  favorites?: string[]
  onToggleFavorite?: (productId: string) => void
  onAddToCart?: (product: Product, options: Record<string, string>, variantId: string) => Promise<boolean>
}

const ALL = 'All favorites'

// Drinks get sugar, ice and milk choices; the menu catalog tags them, Shopify products use types.
const isDrink = (product: Product) =>
  product.tags.includes(DRINK_TAG) || ['Espresso', 'Pour Over', 'Cold Brew'].includes(product.productType)

const formatMoney = (m: Money) => {
  const num = Number(m.amount)
  const val = num < 500 ? Math.round(num * 10000) : Math.round(num)
  return `${val.toLocaleString('vi-VN')} đ`
}

export function DrinkMenu({
  products,
  catalogError,
  favorites = [],
  onToggleFavorite,
  onAddToCart,
}: DrinkMenuProps) {
  const [activeCategory, setActiveCategory] = useState<string>(ALL)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('All prices')
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false)

  // Customization modal states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string>('')
  const [selectedSize, setSelectedSize] = useState<string>('Tiêu chuẩn (12oz)')
  const [sugarLevel, setSugarLevel] = useState<string>('100% (Bình thường)')
  const [iceLevel, setIceLevel] = useState<string>('100% (Tiêu chuẩn)')
  const [milkChoice, setMilkChoice] = useState<string>('Sữa tươi nguyên kem (Whole)')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Tabs are the categories the menu actually has, in the order they first appear.
  const categories = [ALL, ...new Set(products.map((p) => p.productType))]

  const filteredProducts = products.filter((p) => {
    const matchesCat = activeCategory === ALL || p.productType === activeCategory
    const query = searchQuery.toLowerCase().trim()
    const matchesQuery = !query || `${p.title} ${p.description}`.toLowerCase().includes(query)
    const rawPrice = Number(p.variants.nodes[0]?.price.amount)
    const priceInVnd = rawPrice < 500 ? rawPrice * 10000 : rawPrice
    const matchesPrice = maxPrice === 'All prices' || priceInVnd <= Number(maxPrice)
    const matchesFav = !showFavoritesOnly || favorites.includes(p.id)
    return matchesCat && matchesQuery && matchesPrice && matchesFav
  })

  const openCustomizeModal = (product: Product) => {
    setSelectedProduct(product)
    const firstVariant = product.variants.nodes[0]
    setSelectedVariantId(firstVariant?.id ?? '')
    setSelectedSize(firstVariant?.title ?? 'Regular')
    setSugarLevel('100% (Bình thường)')
    setIceLevel('100% (Tiêu chuẩn)')
    setMilkChoice('Sữa tươi nguyên kem (Whole)')
  }

  const handleConfirmAdd = async () => {
    if (!selectedProduct) return
    setIsSubmitting(true)
    const options: Record<string, string> = isDrink(selectedProduct)
      ? {
          Size: selectedSize,
          Sugar: sugarLevel,
          Ice: iceLevel,
          Milk: milkChoice,
        }
      : {
          Size: selectedSize,
        }

    try {
      if (onAddToCart) {
        await onAddToCart(selectedProduct, options, selectedVariantId)
      } else {
        // Fallback direct cart call
        await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            variantId: selectedVariantId,
            options,
          }),
        })
        toast.success(`Đã thêm ${selectedProduct.title} vào túi cà phê!`)
      }
      setSelectedProduct(null)
    } catch {
      toast.error('Không thể thêm món vào giỏ hàng. Vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuickAdd = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    const defaultVariant = product.variants.nodes[0]
    if (!defaultVariant?.availableForSale) return
    setIsSubmitting(true)
    try {
      if (onAddToCart) {
        await onAddToCart(product, {}, defaultVariant.id)
      } else {
        await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            variantId: defaultVariant.id,
            options: {},
          }),
        })
        toast.success(`Đã thêm ${product.title} vào giỏ hàng!`)
      }
    } catch {
      toast.error('Có lỗi xảy ra khi thêm vào giỏ.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="menu-section section-shell py-10 md:py-14 scroll-mt-24" id="menu">
      {/* Section Header */}
      <div className="section-heading mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="eyebrow inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#89684f]">
            <Sparkles className="size-3 text-amber-600" />
            THƯỞNG THỨC TRỌN VẸN · THỰC ĐƠN THƯỢNG HẠNG
          </p>
          <h2 className="font-display mt-2 text-3xl md:text-[2.6rem] font-semibold text-[#35281f] leading-[1.25] text-balance">
            Khám phá món ngon yêu thích.
          </h2>
        </div>
        <p className="text-sm text-[#8b7e71] max-w-sm">
          Mỗi ly thức uống là một công thức sáng tạo tỉ mỉ từ nguyên liệu tươi nguyên và hạt cà phê mộc.
        </p>
      </div>

      {/* Categories Toolbar */}
      <div className="menu-toolbar mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-stone-200/80 pb-4">
        <div className="category-tabs flex flex-wrap items-center gap-2" role="group" aria-label="Coffee categories">
          {categories.map((cat, idx) => {
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs md:text-sm transition-all duration-200 border ${
                  isActive
                    ? 'bg-[#3E2723] text-white border-[#3E2723] shadow-xs font-semibold'
                    : 'bg-white text-stone-700 border-stone-200/80 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                {idx === 0 && <Sparkles className="size-3.5 text-amber-400" />}
                <span>{cat === ALL ? 'Tất cả' : cat}</span>
                {cat === ALL && <span className="sr-only">({ALL})</span>}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          aria-expanded={isFilterOpen}
          aria-label="Bộ lọc thực đơn"
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="inline-flex items-center gap-2 rounded-xl border border-stone-200/80 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900 shadow-2xs"
        >
          <SlidersHorizontal className="size-3.5 text-stone-500" />
          <span>Bộ lọc</span>
          <span className="sr-only">Filters</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="search-row mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-stone-200/80 shadow-xs">
        <label className="search-field flex flex-1 items-center gap-2.5 text-stone-500 px-2">
          <Search className="size-4 text-[#3E2723]" />
          <input
            id="menu-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm thức uống, loại hạt, hương vị mong muốn..."
            aria-label="Search coffee menu"
            className="w-full bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="text-stone-400 hover:text-stone-800">
              <X className="size-4" />
            </button>
          )}
        </label>

        <div className="flex items-center gap-3 px-2 text-xs text-stone-500">
          <span>
            {showFavoritesOnly ? 'Mục yêu thích đã lưu' : `Hiển thị ${filteredProducts.length} món ngon đặc sắc`}
          </span>
          {showFavoritesOnly && (
            <button
              type="button"
              onClick={() => setShowFavoritesOnly(false)}
              aria-label="Bỏ lọc danh sách yêu thích"
              className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 text-xs text-[#3E2723] font-medium"
            >
              <X className="size-3" /> Tất cả
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filters Drawer */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="filters mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-[#e5ddd2] bg-[#f9f6f0] p-4 text-xs overflow-hidden"
          >
            <div>
              <label htmlFor="price-select" className="mb-1.5 block font-semibold text-[#6f4e37]">
                Mức giá tối đa
              </label>
              <select
                id="price-select"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full rounded-xl border border-[#e5ddd2] bg-[#ffffff] p-2.5 text-xs text-[#35281f] focus:outline-none focus:ring-1 focus:ring-[#6f4e37]"
              >
                <option value="All prices">Tất cả mức giá</option>
                <option value="50000">Dưới 50.000 đ</option>
                <option value="80000">Dưới 80.000 đ</option>
                <option value="150000">Dưới 150.000 đ</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl border-[#d5c7b5] text-[#6f4e37] hover:bg-[#ede6dc]"
                onClick={() => {
                  setMaxPrice('All prices')
                  setSearchQuery('')
                }}
              >
                Thiết lập lại bộ lọc
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Catalog Error Banner */}
      {catalogError && (
        <div role="alert" className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
          {catalogError}
        </div>
      )}

      {/* Product Grid */}
      <div className="product-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredProducts.map((p) => {
          const firstVariant = p.variants.nodes[0]
          const isFav = favorites.includes(p.id)
          const tagLabel = isDrink(p) ? 'PHA MỖI NGÀY' : 'BÁNH TƯƠI MỖI NGÀY'

          return (
            <motion.article
              key={p.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="product-card group relative flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-[0_12px_32px_-8px_rgba(62,39,35,0.12)]"
            >
              {/* Product Photo Box */}
              <div className="product-image relative aspect-square w-full overflow-hidden rounded-xl bg-stone-100">
                <button
                  type="button"
                  className="product-photo-button size-full p-0 border-0 bg-transparent"
                  onClick={() => openCustomizeModal(p)}
                  aria-label={`Tùy chỉnh ${p.title}`}
                >
                  {p.featuredImage ? (
                    <img
                      src={p.featuredImage.url}
                      alt={p.featuredImage.altText || p.title}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="size-full flex items-center justify-center text-stone-400">
                      <Coffee className="size-12 opacity-40" />
                    </div>
                  )}
                </button>

                {/* Badge Tag */}
                <span className="product-tag absolute top-3 left-3 rounded-lg bg-white/95 px-2.5 py-1 text-[9px] font-bold tracking-wider text-[#3E2723] backdrop-blur-xs shadow-xs border border-stone-200/60">
                  {tagLabel}
                </span>

                {/* Favorite Heart Button */}
                <button
                  type="button"
                  aria-label={`Lưu ${p.title} vào danh sách yêu thích`}
                  aria-pressed={isFav}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleFavorite?.(p.id)
                  }}
                  className={`heart-button absolute top-3 right-3 flex size-8.5 items-center justify-center rounded-full bg-white/95 text-stone-600 backdrop-blur-xs shadow-xs transition-colors hover:text-red-500 hover:bg-white ${
                    isFav ? 'text-red-500 fill-red-500' : ''
                  }`}
                >
                  <Heart className={`size-4 ${isFav ? 'fill-current text-red-500' : ''}`} />
                </button>
              </div>

              {/* Product Information */}
              <div className="product-info mt-4 flex flex-1 flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                    <span>{p.productType}</span>
                    {p.tags.includes('Vietnam') && <span>· ARABICA CẦU ĐẤT</span>}
                  </div>

                  <button
                    type="button"
                    onClick={() => openCustomizeModal(p)}
                    className="product-title mt-1.5 text-left font-sans text-lg font-bold text-stone-900 group-hover:text-amber-800 transition-colors leading-snug line-clamp-1"
                  >
                    {p.title}
                  </button>

                  <p className="mt-1.5 text-xs leading-relaxed text-stone-600 line-clamp-2 min-h-9">
                    {p.description}
                  </p>
                </div>

                {/* Bottom Bar: Price & Add Button */}
                <div className="product-bottom mt-4 flex items-center justify-between border-t border-stone-100 pt-3.5">
                  <div>
                    <strong className="text-lg font-extrabold text-stone-900 tabular-nums">
                      {firstVariant ? formatMoney(firstVariant.price) : '50.000 đ'}
                    </strong>
                    {p.variants.nodes.length > 1 && (
                      <small className="ml-1 text-[11px] text-stone-500 font-medium">/ từ</small>
                    )}
                  </div>

                  <button
                    type="button"
                    aria-label={`Thêm ${p.title} vào giỏ hàng`}
                    disabled={!firstVariant?.availableForSale || isSubmitting}
                    onClick={(e) => handleQuickAdd(p, e)}
                    className="inline-flex size-10 items-center justify-center rounded-xl bg-[#3E2723] text-white shadow-xs transition-all hover:bg-[#2b1b18] active:scale-95 disabled:opacity-50"
                  >
                    <Plus className="size-4.5" />
                  </button>
                </div>
              </div>
            </motion.article>
          )
        })}
      </div>

      {/* Empty State */}
      {!filteredProducts.length && !catalogError && (
        <div className="empty-menu my-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#e5ddd2] p-12 text-center bg-[#faf7f2]">
          <Coffee className="size-12 text-[#9c846c] mb-3 opacity-60" />
          <h3 className="font-sans font-bold text-2xl text-[#35281f]">Một hương vị mới đang chờ đón bạn.</h3>
          <p className="mt-1 text-xs text-[#8b7e71]">Không có món nào phù hợp với bộ lọc này. Hãy thử chọn danh mục khác nhé.</p>
          <Button
            variant="outline"
            className="mt-4 rounded-xl border-[#6f4e37] text-[#6f4e37] hover:bg-[#6f4e37] hover:text-white"
            onClick={() => {
              setActiveCategory(ALL)
              setSearchQuery('')
              setMaxPrice('All prices')
              setShowFavoritesOnly(false)
            }}
          >
            Xem tất cả thực đơn
          </Button>
        </div>
      )}

      {/* Customization Dialog Modal */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-md rounded-2xl border-stone-200/80 bg-[#FAF8F5] p-6 text-stone-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="font-sans text-2xl font-bold text-stone-900 flex items-center justify-between">
              <span>{selectedProduct?.title}</span>
              <Badge className="bg-[#3E2723] text-white text-[11px] font-semibold">
                {selectedProduct?.productType}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Tuỳ chỉnh công thức theo gu thưởng thức riêng của bạn
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4 py-2 text-xs">
              <p className="text-xs leading-relaxed text-stone-700 bg-white p-3.5 rounded-xl border border-stone-200/80 shadow-2xs">
                {selectedProduct.description}
              </p>

              {/* Size selection */}
              <div>
                <label className="mb-1.5 block font-semibold text-[#3E2723]">
                  Chọn kích cỡ ly
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedProduct.variants.nodes.map((v) => {
                    const isSelected = selectedVariantId === v.id
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={!v.availableForSale}
                        onClick={() => {
                          setSelectedVariantId(v.id)
                          setSelectedSize(v.title)
                        }}
                        className={`flex items-center justify-between rounded-xl p-3 border text-left transition-all ${
                          isSelected
                            ? 'border-[#3E2723] bg-[#3E2723]/10 font-bold text-[#3E2723] shadow-2xs ring-1 ring-[#3E2723]'
                            : 'border-stone-200/80 bg-white text-stone-800 hover:bg-stone-50'
                        } ${!v.availableForSale ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <span className="truncate">{v.title}</span>
                        <span className="font-semibold tabular-nums">{formatMoney(v.price)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Coffee Customizations (Sugar, Ice, Milk) */}
              {isDrink(selectedProduct) && (
                <>
                  {/* Sugar Level */}
                  <div>
                    <label className="mb-1.5 block font-semibold text-[#3E2723]">
                      Lượng ngọt
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {['100% (Chuẩn)', '70% (Ít)', '50% (Vừa)', '0% (Không)'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSugarLevel(s)}
                          className={`rounded-xl py-2 px-1 text-center text-[11px] border transition-all ${
                            sugarLevel === s
                              ? 'border-[#3E2723] bg-[#3E2723] text-white font-semibold shadow-2xs'
                              : 'border-stone-200/80 bg-white text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ice Level (if Cold Brew or iced) */}
                  <div>
                    <label className="mb-1.5 block font-semibold text-[#3E2723]">
                      Lượng đá
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['100% (Đầy đủ)', '50% (Ít đá)', '0% (Không đá)'].map((ice) => (
                        <button
                          key={ice}
                          type="button"
                          onClick={() => setIceLevel(ice)}
                          className={`rounded-xl py-2 px-1 text-center text-[11px] border transition-all ${
                            iceLevel === ice
                              ? 'border-[#3E2723] bg-[#3E2723] text-white font-semibold shadow-2xs'
                              : 'border-stone-200/80 bg-white text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          {ice}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Milk Type */}
                  <div>
                    <label className="mb-1.5 block font-semibold text-[#3E2723]">
                      Loại sữa kèm theo
                    </label>
                    <select
                      value={milkChoice}
                      onChange={(e) => setMilkChoice(e.target.value)}
                      className="w-full rounded-xl border border-stone-200/80 bg-white p-2.5 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
                    >
                      <option value="Sữa tươi nguyên kem (Whole)">Sữa tươi nguyên kem</option>
                      <option value="Sữa yến mạch hữu cơ (Oat)">Sữa yến mạch hữu cơ</option>
                      <option value="Sữa hạnh nhân thơm nhẹ (Almond)">Sữa hạnh nhân thơm nhẹ</option>
                      <option value="Không dùng sữa (None)">Không dùng sữa (Cà phê đen)</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSelectedProduct(null)}
              className="rounded-xl border-stone-300 text-stone-700 hover:bg-stone-100"
            >
              Hủy
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={handleConfirmAdd}
              className="h-11 rounded-xl bg-[#3E2723] text-white hover:bg-[#2e1d1a] font-bold text-xs px-5 shadow-sm"
            >
              {isSubmitting ? (
                'Đang thêm...'
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Check className="size-4" /> Thêm vào giỏ
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
export default DrinkMenu

