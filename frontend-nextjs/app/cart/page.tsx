'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Coffee,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCartStore, formatMoneyVND } from '@/lib/store/cart-store'
import { toast } from 'sonner'

export default function CartPage() {
  const router = useRouter()
  const { cart, updateQuantity, applyPromo, updateNote, isBusy } = useCartStore()

  const [promoCode, setPromoCode] = useState('')
  const [orderNote, setOrderNote] = useState(cart?.note ?? '')

  const lineItems = cart?.lines?.nodes ?? []
  const subtotal = Number(cart?.cost?.subtotalAmount?.amount ?? '0')
  const isDiscounted = cart?.discountCodes?.some((d) => d.applicable)
  const discountAmount = isDiscounted ? subtotal * 0.1 : 0
  const total = Math.max(0, subtotal - discountAmount)

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoCode.trim()) return
    await applyPromo(promoCode)
  }

  const handleSaveNote = async () => {
    if (orderNote !== cart?.note) {
      await updateNote(orderNote)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 font-sans pb-16">
      {/* Header */}
      <header className="border-b border-stone-200/80 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <ArrowLeft className="size-4 text-stone-500 group-hover:text-stone-900 transition-colors" />
            <span className="text-xs font-semibold text-stone-600 group-hover:text-stone-900">
              Tiếp tục chọn cà phê
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-[#3E2723] text-white flex items-center justify-center">
              <Coffee className="size-4.5" />
            </div>
            <span className="font-extrabold text-base text-stone-900">Giỏ hàng Đà Lạt Cafe</span>
          </div>
          <div className="text-xs font-bold tabular-nums text-stone-600">
            {cart?.totalQuantity ?? 0} món
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold text-stone-900 mb-6">
          Chi tiết giỏ hàng của bạn
        </h1>

        {lineItems.length === 0 ? (
          <div className="rounded-3xl border border-stone-200/80 bg-white p-12 text-center max-w-lg mx-auto space-y-4 shadow-xs">
            <div className="size-20 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mx-auto">
              <ShoppingBag className="size-10 opacity-50" />
            </div>
            <h2 className="text-xl font-bold text-stone-900">Túi cà phê của bạn đang trống</h2>
            <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
              Bạn chưa thêm món nào vào giỏ. Hãy ghé qua thực đơn để khám phá các dòng cà phê thơm ngon vừa mới rang nhé!
            </p>
            <Button
              onClick={() => router.push('/#menu')}
              className="rounded-xl bg-[#3E2723] hover:bg-[#2b1b18] text-white font-semibold text-xs h-11 px-6 cursor-pointer"
            >
              Xem thực đơn quán
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Items list */}
            <div className="lg:col-span-8 space-y-4">
              <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs divide-y divide-stone-100">
                {lineItems.map((line) => {
                  const lineTotal = Number(line.merchandise.price.amount) * line.quantity
                  return (
                    <div key={line.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {line.merchandise.product.featuredImage?.url ? (
                        <img
                          src={line.merchandise.product.featuredImage.url}
                          alt={line.merchandise.product.title}
                          className="size-20 rounded-xl object-cover border border-stone-100 shrink-0"
                        />
                      ) : (
                        <div className="size-20 rounded-xl bg-stone-100 flex items-center justify-center text-stone-400 shrink-0">
                          <ShoppingBag className="size-8 opacity-40" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-stone-900">{line.merchandise.product.title}</h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {line.merchandise.title}
                          {line.attributes.map((a) => ` · ${a.value}`).join('')}
                        </p>
                        <span className="text-xs font-bold text-[#3E2723] block mt-1 tabular-nums">
                          Đơn giá: {formatMoneyVND(line.merchandise.price)}
                        </span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 p-1">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => updateQuantity(line.id, line.quantity - 1)}
                            className="size-7 flex items-center justify-center rounded text-stone-600 hover:bg-stone-200 hover:text-stone-900 transition-colors disabled:opacity-50"
                          >
                            {line.quantity === 1 ? <Trash2 className="size-3.5 text-red-500" /> : <Minus className="size-3.5" />}
                          </button>
                          <span className="w-6 text-center text-xs font-bold tabular-nums text-stone-900">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => updateQuantity(line.id, line.quantity + 1)}
                            className="size-7 flex items-center justify-center rounded text-stone-600 hover:bg-stone-200 hover:text-stone-900 transition-colors disabled:opacity-50"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>

                        <span className="w-24 text-right font-extrabold text-sm tabular-nums text-stone-900">
                          {formatMoneyVND(lineTotal)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Barista Note */}
              <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs space-y-2">
                <label className="text-xs font-bold text-[#3E2723] block">
                  Ghi chú cho Barista
                </label>
                <textarea
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  onBlur={handleSaveNote}
                  placeholder="Ví dụ: Xin làm ít ngọt, nhiều đá hoặc tách riêng trân châu..."
                  className="w-full rounded-xl border border-stone-200 p-3 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
                  rows={2}
                />
              </div>
            </div>

            {/* Order Summary Column */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-4">
                <h3 className="font-bold text-base text-stone-900">Tóm tắt đơn hàng</h3>

                {/* Promo Code Form */}
                <form onSubmit={handleApplyPromo} className="flex gap-2">
                  <input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Mã ưu đãi (VD: WELCOME10)"
                    className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-xs uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={isBusy || !promoCode}
                    className="rounded-xl border-stone-300 text-[#3E2723] text-xs font-semibold hover:bg-stone-100"
                  >
                    Áp dụng
                  </Button>
                </form>

                <div className="space-y-2 border-t border-stone-200/80 pt-4 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>Tạm tính</span>
                    <span className="font-semibold tabular-nums text-stone-900">
                      {formatMoneyVND(subtotal)}
                    </span>
                  </div>
                  {isDiscounted && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Ưu đãi thành viên (-10%)</span>
                      <span className="font-semibold tabular-nums">-{formatMoneyVND(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-600">
                    <span>Phí vận chuyển</span>
                    <span className="text-stone-500 italic">Tính tại bước kế tiếp</span>
                  </div>
                  <div className="flex justify-between border-t border-stone-200/80 pt-3 text-sm font-bold text-stone-900">
                    <span>Tổng thanh toán</span>
                    <span className="tabular-nums text-lg text-[#3E2723] font-extrabold">
                      {formatMoneyVND(total)}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => router.push('/checkout')}
                  className="w-full h-12 rounded-xl bg-[#3E2723] hover:bg-[#2b1b18] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <span>Tiến hành đặt hàng</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

