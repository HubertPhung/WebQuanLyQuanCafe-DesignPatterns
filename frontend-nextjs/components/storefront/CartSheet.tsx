'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Check,
  Copy,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  Trash2,
  X,
  CreditCard,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Cart, Money } from '@/lib/shopify'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
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

  // Support both controlled props and global Zustand store
  const isOpen = propsIsOpen !== undefined ? propsIsOpen : store.isOpen
  const setIsOpen = propsOnOpenChange !== undefined ? propsOnOpenChange : store.setIsOpen
  const cart = propsCart !== undefined ? propsCart : store.cart

  const [isBusy, setIsBusy] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [orderNote, setOrderNote] = useState(cart?.note ?? '')
  const [promoNotice, setPromoNotice] = useState('')
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

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
        if (updated && updated.discountCodes?.some((c) => c.applicable)) {
          setPromoNotice('Mã ưu đãi đã áp dụng thành công (-10%)!')
          toast.success('Áp dụng mã giảm giá thành công!')
        } else {
          setPromoNotice('Mã ưu đãi không hợp lệ. (Thử mã: WELCOME10)')
          toast.error('Mã không hợp lệ hoặc đã hết hạn.')
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setIsCopied(true)
    toast.success('Đã sao chép số tài khoản vào bộ nhớ tạm!')
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleConfirmQrPayment = () => {
    setIsQrModalOpen(false)
    setIsOpen(false)
    toast.success('Thanh toán VietQR thành công! Đơn hàng đã gửi tới Barista.')
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-md bg-[#FAF8F5] text-stone-900 border-l border-stone-200/80 font-sans">
          <SheetHeader className="border-b border-stone-200/80 px-6 py-5 bg-white">
            <SheetTitle className="font-sans text-xl font-bold text-stone-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingBag className="size-5 text-[#3E2723]" />
                <span>Giỏ hàng của bạn</span>
              </span>
              <span className="text-xs font-sans font-bold bg-[#3E2723] text-white px-2.5 py-0.5 rounded-full tabular-nums">
                {cart?.totalQuantity ?? 0} món
              </span>
            </SheetTitle>
            <SheetDescription className="text-xs text-stone-500 font-sans">
              Tuyển tập cà phê hảo hạng · Rang mộc nguyên bản chuẩn vị.
            </SheetDescription>
          </SheetHeader>

          {/* Cart Items List */}
          <div className="cart-body flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {!lineItems.length ? (
              <div className="empty-menu flex flex-col items-center justify-center py-16 text-center space-y-3">
                <div className="size-20 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                  <ShoppingBag className="size-10 opacity-50" />
                </div>
                <h3 className="font-sans text-lg font-bold text-stone-900">
                  Túi cà phê của bạn đang trống
                </h3>
                <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
                  Hãy chọn một vài món cà phê thơm lừng từ thực đơn để nạp năng lượng cho ngày mới nhé!
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsOpen(false)
                    const el = document.getElementById('menu')
                    if (el) el.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="rounded-xl border-stone-300 text-stone-800 hover:bg-stone-100 mt-2 font-semibold text-xs cursor-pointer"
                >
                  Khám phá thực đơn
                </Button>
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
                            src={line.merchandise.product.featuredImage.url}
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

                {/* Note for Barista */}
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

                {/* Promo Code Input Form */}
                <form onSubmit={handleApplyPromo} className="promo-form flex gap-2">
                  <input
                    aria-label="Mã giảm giá"
                    placeholder="Mã ưu đãi (VD: WELCOME10)"
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

                {/* Bill Summary */}
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

          {/* Footer CTAs */}
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

              {/* VietQR Quick Payment Option */}
              <Button
                onClick={() => setIsQrModalOpen(true)}
                variant="outline"
                className="w-full h-10.5 rounded-xl border-[#005ba6]/40 text-[#005ba6] hover:bg-sky-50 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <QrCode className="size-4" />
                <span>Thanh toán nhanh VietQR 24/7</span>
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

      {/* VietQR Payment Modal Simulation */}
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border-stone-200 bg-white p-6 text-stone-900 shadow-xl font-sans">
          <DialogHeader className="text-center sm:text-left">
            <div className="flex items-center justify-between mb-1">
              <Badge className="bg-[#005ba6] text-white text-xs px-2.5 py-0.5">
                VietQR · Chuyển khoản tức thì
              </Badge>
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Đang chờ quét
              </span>
            </div>
            <DialogTitle className="text-xl font-bold text-stone-900">
              Quét mã QR để thanh toán
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Mở ứng dụng ngân hàng bất kỳ (Vietcombank, MBBank, Techcombank, Momo, v.v.) và quét mã dưới đây:
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-3">
            {/* Simulated QR Box */}
            <div className="relative rounded-2xl border-2 border-[#005ba6]/30 bg-slate-50 p-4 shadow-sm flex flex-col items-center">
              <div className="size-48 bg-white border border-slate-200 rounded-xl p-2 flex items-center justify-center shadow-inner">
                <svg className="size-full text-slate-800" viewBox="0 0 100 100" fill="currentColor">
                  <path d="M10 10 h25 v25 h-25 z M15 15 v15 h15 v-15 z M19 19 h7 v7 h-7 z" />
                  <path d="M65 10 h25 v25 h-25 z M70 15 v15 h15 v-15 z M74 19 h7 v7 h-7 z" />
                  <path d="M10 65 h25 v25 h-25 z M15 70 v15 h15 v-15 z M19 74 h7 v7 h-7 z" />
                  <rect x="42" y="10" width="16" height="6" />
                  <rect x="42" y="22" width="6" height="18" />
                  <rect x="52" y="24" width="8" height="8" />
                  <rect x="10" y="42" width="8" height="16" />
                  <rect x="24" y="42" width="16" height="6" />
                  <rect x="42" y="42" width="16" height="16" />
                  <rect x="65" y="42" width="10" height="12" />
                  <rect x="80" y="42" width="10" height="24" />
                  <rect x="42" y="65" width="8" height="25" />
                  <rect x="56" y="70" width="14" height="8" />
                  <rect x="56" y="82" width="24" height="8" />
                </svg>
              </div>

              <div className="mt-3 text-center">
                <p className="text-xs font-semibold text-stone-700">Ngân hàng TMCP Ngoại Thương (Vietcombank)</p>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  <span className="font-mono text-sm font-bold text-stone-900 tracking-wider">
                    0123 4567 8999
                  </span>
                  <button
                    onClick={() => copyToClipboard('012345678999')}
                    className="p-1 hover:bg-stone-200 rounded text-stone-600 transition-colors"
                    title="Sao chép số tài khoản"
                  >
                    {isCopied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5">Chủ TK: CONG TY TNHH DA LAT CAFE</p>
                <p className="mt-2 text-base font-extrabold text-[#3E2723] tabular-nums">
                  {formatMoneyVND(totalAmount)}
                </p>
              </div>
            </div>

            <p className="mt-3 text-center text-[11px] text-stone-500">
              Hệ thống sẽ tự động xác nhận đơn ngay khi giao dịch chuyển khoản thành công.
            </p>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <Button
              onClick={handleConfirmQrPayment}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              Tôi đã chuyển khoản thành công
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsQrModalOpen(false)}
              className="w-full text-xs text-stone-600"
            >
              Quay lại giỏ hàng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
export default CartSheet

