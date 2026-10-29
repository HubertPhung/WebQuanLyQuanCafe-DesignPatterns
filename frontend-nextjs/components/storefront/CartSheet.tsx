'use client'

import { localImageSrc } from '@/lib/assets'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
  CreditCard,
  Sparkles,
  CalendarCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Cart, Money } from '@/lib/shopify'
import { Button } from '@/components/ui/button'
import { useReservationStore } from '@/lib/store/reservation-store'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useCartStore, formatMoneyVND } from '@/lib/store/cart-store'

export interface CartSheetProps {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  cart?: Cart | null
  onUpdateCart?: (body: Record<string, unknown>) => Promise<Cart | null>
}

export function CartSheet({
  isOpen: propsIsOpen,
  onOpenChange: propsOnOpenChange,
  cart: propsCart,
  onUpdateCart,
}: CartSheetProps) {
  const router = useRouter()
  const store = useCartStore()

  // Hỗ trợ cả props điều khiển từ ngoài lẫn store Zustand toàn cục
  const isOpen = propsIsOpen !== undefined ? propsIsOpen : store.isOpen
  const setIsOpen = propsOnOpenChange !== undefined ? propsOnOpenChange : store.setIsOpen
  const cart = propsCart !== undefined ? propsCart : store.cart

  const [isBusy, setIsBusy] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [orderNote, setOrderNote] = useState(cart?.note ?? '')
  const [promoNotice, setPromoNotice] = useState('')

  const lineItems = cart?.lines?.nodes ?? []
  const totalAmount = cart?.cost?.totalAmount
  const subtotalAmount = cart?.cost?.subtotalAmount

  const handleUpdateQty = async (lineId: string, quantity: number) => {
    setIsBusy(true)
    try {
      if (onUpdateCart) {
        await onUpdateCart({ action: 'quantity', lineId, quantity })
      } else {
        await store.updateQuantity(lineId, quantity)
      }
    } finally {
      setIsBusy(false)
    }
  }

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoCode.trim()) return
    setIsBusy(true)
    setPromoNotice('')
    try {
      if (onUpdateCart) {
        const updated = await onUpdateCart({ action: 'discount', code: promoCode.trim() })
        const reason = (updated as { voucherMessage?: string } | null | undefined)?.voucherMessage
        if (updated && updated.discountCodes?.some((c) => c.applicable)) {
          setPromoNotice(reason || 'Mã ưu đãi đã áp dụng thành công!')
          toast.success('Áp dụng mã giảm giá thành công!')
        } else {
          setPromoNotice(reason || 'Mã ưu đãi không hợp lệ hoặc đã hết hạn.')
          toast.error(reason || 'Mã không hợp lệ hoặc đã hết hạn.')
        }
      } else {
        const res = await store.applyPromo(promoCode)
        setPromoNotice(res.message)
      }
    } finally {
      setIsBusy(false)
    }
  }

  const handleSaveNote = async () => {
    if (orderNote !== cart?.note) {
      if (onUpdateCart) {
        await onUpdateCart({ action: 'note', note: orderNote })
        toast.success('Đã lưu ghi chú cho barista!')
      } else {
        await store.updateNote(orderNote)
      }
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-md bg-[#FAF8F5] text-stone-900 border-l border-stone-200/80 font-sans">
          <SheetHeader className="relative border-b border-stone-200/80 bg-white px-5 py-4">
            <div className="flex items-center justify-between pr-8">
              <SheetTitle className="flex items-center gap-2.5 !m-0 font-sans !text-base sm:!text-lg font-bold text-stone-900 leading-tight">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-[#3E2723] ring-1 ring-amber-200/70">
                  <ShoppingBag className="size-4.5" />
                </span>
                <span className="whitespace-nowrap">Giỏ hàng của bạn</span>
              </SheetTitle>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#3E2723] px-3 py-1 text-xs font-semibold text-white tabular-nums shadow-2xs">
                <span className="font-bold">{cart?.totalQuantity ?? 0}</span>
                <span className="font-normal opacity-90">món</span>
              </span>
            </div>
            <SheetDescription className="mt-1 text-xs text-stone-500 font-sans">
              Tuyển tập cà phê hảo hạng · Rang mộc nguyên bản chuẩn vị.
            </SheetDescription>
          </SheetHeader>

          {/* Danh sách món trong giỏ */}
          <div className="cart-body flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {!lineItems.length ? (
              <div className="empty-menu flex flex-col items-center justify-center py-14 text-center space-y-3">
                <div className="flex size-18 items-center justify-center rounded-full bg-stone-100 text-stone-400 ring-1 ring-stone-200/60">
                  <ShoppingBag className="size-8 opacity-60 text-stone-500" />
                </div>
                <h3 className="font-display !text-xl font-semibold text-stone-900 leading-snug">
                  Túi cà phê của bạn đang trống
                </h3>
                <p className="max-w-xs text-xs leading-relaxed text-stone-500">
                  Hãy chọn một vài món cà phê thơm lừng từ thực đơn để nạp năng lượng cho ngày mới nhé!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    const el = document.getElementById('menu')
                    if (el) {
                      const headerOffset = 84
                      const elementPosition = el.getBoundingClientRect().top
                      const offsetPosition = elementPosition + (window.scrollY || window.pageYOffset || 0) - headerOffset
                      window.scrollTo({ top: Math.max(0, offsetPosition), behavior: 'smooth' })
                    }
                  }}
                  className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-5 text-xs font-semibold text-stone-800 shadow-2xs transition-all hover:border-[#3E2723] hover:bg-stone-50 hover:text-[#3E2723] active:scale-95 cursor-pointer"
                >
                  <Sparkles className="size-3.5 text-amber-600" />
                  <span>Khám phá thực đơn</span>
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {lineItems.map((line) => {
                    const linePrice = Number(line.merchandise.price.amount)
                    const lineTotal = linePrice * line.quantity
                    return (
                      <div
                        key={line.id}
                        className="cart-line flex items-center gap-3.5 rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-2xs transition-all hover:border-amber-300"
                      >
                        {line.merchandise.product.featuredImage?.url ? (
                          <img
                            src={localImageSrc(line.merchandise.product.featuredImage.url)}
                            alt={line.merchandise.product.title}
                            className="size-16 rounded-xl object-cover border border-stone-100 shrink-0"
                          />
                        ) : (
                          <div className="size-16 rounded-xl bg-stone-100 flex items-center justify-center text-stone-400 shrink-0">
                            <ShoppingBag className="size-6 opacity-40" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <strong className="block truncate text-sm font-bold text-stone-900">
                            {line.merchandise.product.title}
                          </strong>
                          <p className="text-[11px] text-stone-500 truncate mt-0.5 font-medium">
                            {line.merchandise.title}
                            {line.attributes.map((a) => ` · ${a.value}`).join('')}
                          </p>

                          <div className="quantity mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 p-0.5">
                              <button
                                type="button"
                                disabled={isBusy || store.isBusy}
                                aria-label={`Giảm số lượng ${line.merchandise.product.title}`}
                                onClick={() => handleUpdateQty(line.id, line.quantity - 1)}
                                className="flex size-6 items-center justify-center rounded-md text-stone-600 hover:bg-stone-200 hover:text-stone-900 disabled:opacity-50 cursor-pointer"
                              >
                                {line.quantity === 1 ? (
                                  <Trash2 className="size-3 text-red-500" />
                                ) : (
                                  <Minus className="size-3" />
                                )}
                              </button>
                              <span className="w-5 text-center text-xs font-bold tabular-nums text-stone-900">
                                {line.quantity}
                              </span>
                              <button
                                type="button"
                                disabled={isBusy || store.isBusy}
                                aria-label={`Tăng số lượng ${line.merchandise.product.title}`}
                                onClick={() => handleUpdateQty(line.id, line.quantity + 1)}
                                className="flex size-6 items-center justify-center rounded-md text-stone-600 hover:bg-stone-200 hover:text-stone-900 disabled:opacity-50 cursor-pointer"
                              >
                                <Plus className="size-3" />
                              </button>
                            </div>

                            <span className="text-sm font-bold tabular-nums text-[#3E2723]">
                              {formatMoneyVND(lineTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Ghi chú cho barista */}
                <div className="option-label pt-2">
                  <label className="mb-1.5 block text-xs font-semibold text-[#5A3E2B]">
                    Ghi chú cho Barista
                  </label>
                  <textarea
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    onBlur={handleSaveNote}
                    maxLength={500}
                    placeholder="Ghi chú đơn hàng (ít ngọt, nhiều đá...)"
                    className="w-full rounded-xl border border-stone-200/80 bg-white p-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-[#5A3E2B]"
                    rows={2}
                  />
                </div>

                {/* Form nhập mã khuyến mãi */}
                <form onSubmit={handleApplyPromo} className="promo-form flex gap-2">
                  <input
                    aria-label="Mã giảm giá"
                    placeholder="Nhập mã ưu đãi"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="flex-1 rounded-xl border border-stone-200/80 bg-white px-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[#5A3E2B] truncate"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={isBusy || store.isBusy || !promoCode}
                    className="rounded-xl border-stone-300 text-[#5A3E2B] text-xs font-semibold hover:bg-stone-100 cursor-pointer"
                  >
                    Áp dụng
                  </Button>
                </form>

                {promoNotice && (
                  <p
                    role="status"
                    className="text-xs text-[#3E2723] bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-medium"
                  >
                    {promoNotice}
                  </p>
                )}

                {/* Tóm tắt hóa đơn */}
                <div className="cart-total space-y-2 border-t border-stone-200/80 pt-4 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>Tạm tính</span>
                    <span className="font-semibold tabular-nums text-stone-900">
                      {formatMoneyVND(subtotalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Thuế & Phí vận chuyển</span>
                    <span className="text-[11px] text-stone-500 italic">Tính khi thanh toán</span>
                  </div>
                  <div className="flex justify-between border-t border-stone-200/80 pt-3 text-sm font-bold text-stone-900">
                    <span>Tổng thanh toán</span>
                    <div className="text-right">
                      <span className="tabular-nums text-lg text-[#3E2723] font-extrabold block">
                        {formatMoneyVND(totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Các nút hành động ở chân */}
          {lineItems.length > 0 && (
            <div className="border-t border-stone-200/80 bg-white p-5 space-y-2.5">
              {/* Primary CTA: Tiến hành đặt hàng */}
              <Button
                onClick={() => {
                  setIsOpen(false)
                  router.push('/checkout')
                }}
                className="w-full h-12 rounded-xl bg-[#3E2723] hover:bg-[#2b1b18] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <span>Tiến hành đặt hàng</span>
                <ArrowRight className="size-4" />
              </Button>

              {/* Secondary Action: Đặt bàn tại chỗ với các món đã chọn */}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsOpen(false)
                  const preOrders = lineItems.map((line, idx) => ({
                    id: idx + 1,
                    title: line.merchandise.product.title,
                    quantity: line.quantity,
                    price: Number(line.merchandise.price.amount) || 0,
                  }))
                  useReservationStore.getState().openReservation(preOrders)
                }}
                className="w-full h-11 rounded-xl border-[#B4703F]/40 bg-amber-50/50 hover:bg-amber-100/70 text-[#3E2723] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs"
              >
                <CalendarCheck className="size-4 text-[#B45309]" />
                <span>Đặt bàn tại chỗ (Kèm {cart?.totalQuantity ?? 0} món đã chọn)</span>
              </Button>

              {/* Secondary CTA: Xem giỏ hàng */}
              <div className="flex justify-center pt-1">
                <Link
                  href="/cart"
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-semibold text-stone-600 hover:text-[#3E2723] underline underline-offset-4 transition-colors"
                >
                  Xem chi tiết toàn bộ giỏ hàng
                </Link>
              </div>

              <p className="secure-note text-center text-[10px] text-stone-500 pt-1">
                🔒 Cam kết cà phê rang mộc chuẩn vị · Giao hàng hỏa tốc trong 30 phút
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    )
}
export default CartSheet

