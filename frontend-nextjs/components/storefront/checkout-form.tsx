'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Coffee, CreditCard, ShoppingBag, Store, Truck, User } from 'lucide-react'
import { toast } from 'sonner'
import { placeOnlineOrder, type OnlineOrderInput } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'
import { TAX_RATE } from '@/lib/admin/format'
import { formatMoneyVND, useCartStore } from '@/lib/store/cart-store'
import { voucherDiscount } from '@/lib/storefront/vouchers'

type Payment = OnlineOrderInput['payment']
type Fulfilment = OnlineOrderInput['fulfilment']
type Placed = { orderCode: string; total: number; paid: boolean; name: string; payment: Payment; fulfilment: Fulfilment }

const paymentLabels: Record<Payment, string> = {
  vietqr: 'VietQR chuyển khoản',
  card: 'Thẻ Visa / Mastercard / JCB',
  cod: 'Tiền mặt khi nhận hàng',
}

const inputClass =
  'w-full rounded-xl border border-stone-200 p-2.5 font-semibold text-stone-900 placeholder:font-normal placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-[#3E2723]'

function Choice({
  checked,
  onSelect,
  name,
  title,
  hint,
  aside,
}: {
  checked: boolean
  onSelect: () => void
  name: string
  title: string
  hint: string
  aside?: React.ReactNode
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-all ${
        checked ? 'border-[#3E2723] bg-amber-50/40 ring-1 ring-[#3E2723]' : 'border-stone-200 hover:border-stone-300'
      }`}
    >
      <span className="flex items-center gap-3">
        <input type="radio" name={name} checked={checked} onChange={onSelect} className="accent-[#3E2723]" />
        <span>
          <strong className="block font-bold text-stone-900">{title}</strong>
          <span className="text-[11px] text-stone-500">{hint}</span>
        </span>
      </span>
      {aside}
    </label>
  )
}

export function CheckoutForm({ account }: { account: { name: string; email: string } | null }) {
  const { cart, fetchCart } = useCartStore()
  const [name, setName] = useState(account?.name ?? '')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(account?.email ?? '')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [fulfilment, setFulfilment] = useState<Fulfilment>('delivery')
  const [payment, setPayment] = useState<Payment>('vietqr')
  const [placed, setPlaced] = useState<Placed | null>(null)
  const [pending, startTransition] = useTransition()

  const lineItems = cart?.lines?.nodes ?? []
  const subtotal = Number(cart?.cost?.subtotalAmount?.amount ?? '0')
  const voucher = cart?.discountCodes?.find((code) => code.applicable)
  // Priced as Java's VoucherCatalog does; the server re-checks the code and Java the total.
  const discount = voucherDiscount(subtotal, voucher?.code)
  const vat = Math.round((subtotal - discount) * TAX_RATE)
  const total = subtotal - discount + vat

  function submit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await placeOnlineOrder({ name, phone, email, address, note, fulfilment, payment })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setPlaced({ ...result, name, payment, fulfilment })
      await fetchCart()
    })
  }

  if (placed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5] p-4 font-sans text-stone-900">
        <div className="w-full max-w-md space-y-5 rounded-3xl border border-stone-200/80 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="size-10" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-stone-900">Đặt hàng thành công!</h2>
            <p className="text-xs leading-relaxed text-stone-500">
              Mã đơn hàng: <strong className="font-mono text-stone-900">{placed.orderCode}</strong>
            </p>
            <p className="text-xs text-stone-600">
              Cảm ơn <strong className="text-stone-900">{placed.name}</strong>. Quầy pha chế đã nhận đơn của bạn
              {placed.fulfilment === 'delivery' ? ' và sẽ giao tới địa chỉ bạn đã nhập.' : '; bạn có thể ghé quầy lấy khi đồ uống sẵn sàng.'}
            </p>
          </div>
          <div className="space-y-2 rounded-2xl border border-amber-200/60 bg-amber-50/60 p-4 text-left text-xs">
            <div className="flex justify-between font-semibold text-stone-700">
              <span>Phương thức thanh toán:</span>
              <span className="text-[#3E2723]">{paymentLabels[placed.payment]}</span>
            </div>
            <div className="flex justify-between font-semibold text-stone-700">
              <span>Trạng thái:</span>
              <span className={placed.paid ? 'text-emerald-700' : 'text-amber-800'}>{placed.paid ? 'Đã thanh toán' : 'Thanh toán khi nhận'}</span>
            </div>
            <div className="flex justify-between border-t border-amber-200/40 pt-1 text-sm font-bold text-stone-900">
              <span>Tổng thanh toán:</span>
              <span className="text-[#3E2723]">{formatMoneyVND(placed.total)}</span>
            </div>
          </div>
          <Button render={<Link href="/" />} className="h-11 w-full rounded-xl bg-[#3E2723] text-xs font-bold text-white hover:bg-[#2b1b18]">
            Tiếp tục khám phá thực đơn
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-16 font-sans text-stone-900">
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="group flex items-center gap-2">
            <ArrowLeft className="size-4 text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden="true" />
            <span className="text-xs font-semibold text-stone-600 group-hover:text-stone-900">Quay lại cửa hàng</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#3E2723] text-white">
              <Coffee className="size-4.5" aria-hidden="true" />
            </div>
            <span className="text-base font-extrabold text-stone-900">Đà Lạt Cafe Checkout</span>
          </div>
          <span className="w-24" aria-hidden="true" />
        </div>
      </header>

      <form onSubmit={submit} className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <section className="space-y-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs">
              <h3 className="flex items-center gap-2 text-base font-bold text-stone-900">
                <User className="size-4.5 text-[#3E2723]" aria-hidden="true" />
                <span>Thông tin người nhận</span>
              </h3>
              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div>
                  <label htmlFor="checkout-name" className="mb-1 block font-medium text-stone-500">Họ và tên</label>
                  <input id="checkout-name" required minLength={2} maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn An" className={inputClass} />
                </div>
                <div>
                  <label htmlFor="checkout-phone" className="mb-1 block font-medium text-stone-500">Số điện thoại</label>
                  <input id="checkout-phone" required type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0901 234 567" className={`${inputClass} tabular-nums`} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="checkout-email" className="mb-1 block font-medium text-stone-500">Email (không bắt buộc)</label>
                  <input id="checkout-email" type="email" autoComplete="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@example.com" className={inputClass} />
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs">
              <h3 className="flex items-center gap-2 text-base font-bold text-stone-900">
                <Truck className="size-4.5 text-[#3E2723]" aria-hidden="true" />
                <span>Hình thức nhận hàng</span>
              </h3>
              <div className="space-y-2.5 text-xs">
                <Choice
                  name="fulfilment"
                  checked={fulfilment === 'delivery'}
                  onSelect={() => setFulfilment('delivery')}
                  title="Giao hàng tận nơi"
                  hint="Trong nội thành Đà Lạt, khoảng 30–45 phút"
                  aside={<span className="font-bold text-emerald-700">Miễn phí</span>}
                />
                <Choice
                  name="fulfilment"
                  checked={fulfilment === 'pickup'}
                  onSelect={() => setFulfilment('pickup')}
                  title="Tự đến lấy tại quầy"
                  hint="Nhận tại chi nhánh khi đồ uống sẵn sàng"
                  aside={<Store className="size-4 text-stone-400" aria-hidden="true" />}
                />
              </div>
              {fulfilment === 'delivery' && (
                <div className="text-xs">
                  <label htmlFor="checkout-address" className="mb-1 block font-medium text-stone-500">Địa chỉ nhận hàng</label>
                  <input id="checkout-address" required minLength={8} maxLength={200} autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, phường tại Đà Lạt" className={inputClass} />
                </div>
              )}
              <div className="text-xs">
                <label htmlFor="checkout-note" className="mb-1 block font-medium text-stone-500">Ghi chú cho quán (không bắt buộc)</label>
                <textarea id="checkout-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: gọi trước khi giao" className={inputClass} />
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs">
              <h3 className="flex items-center gap-2 text-base font-bold text-stone-900">
                <CreditCard className="size-4.5 text-[#3E2723]" aria-hidden="true" />
                <span>Phương thức thanh toán</span>
              </h3>
              <div className="space-y-2.5 text-xs">
                <Choice name="payment" checked={payment === 'vietqr'} onSelect={() => setPayment('vietqr')} title="VietQR Napas 24/7" hint="Quét mã QR bằng ứng dụng ngân hàng (mô phỏng trong bản đồ án)" />
                <Choice name="payment" checked={payment === 'card'} onSelect={() => setPayment('card')} title="Thẻ Visa / Mastercard / JCB" hint="Thanh toán thẻ (mô phỏng trong bản đồ án)" />
                <Choice name="payment" checked={payment === 'cod'} onSelect={() => setPayment('cod')} title="Tiền mặt khi nhận hàng (COD)" hint="Thanh toán khi nhận đồ uống" />
              </div>
            </section>
          </div>

          <div className="lg:col-span-5">
            <div className="sticky top-24 space-y-5 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs">
              <h3 className="flex items-center justify-between text-base font-bold text-stone-900">
                <span>Đơn hàng của bạn</span>
                <span className="text-xs font-normal text-stone-500">{cart?.totalQuantity ?? 0} sản phẩm</span>
              </h3>

              <div className="max-h-64 divide-y divide-stone-100 overflow-y-auto pr-1">
                {lineItems.length === 0 ? (
                  <p className="py-4 text-center text-xs text-stone-500">Giỏ hàng chưa có sản phẩm nào</p>
                ) : (
                  lineItems.map((line) => (
                    <div key={line.id} className="flex items-center gap-3 py-3">
                      {line.merchandise.product.featuredImage?.url ? (
                        <img src={line.merchandise.product.featuredImage.url} alt="" className="size-12 rounded-lg border border-stone-100 object-cover" />
                      ) : (
                        <div className="flex size-12 items-center justify-center rounded-lg bg-stone-100 text-stone-400">
                          <ShoppingBag className="size-5" aria-hidden="true" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="truncate font-bold text-stone-900">{line.merchandise.product.title}</p>
                        <p className="text-[11px] text-stone-500">
                          {line.merchandise.title} × {line.quantity}
                          {line.attributes.length > 0 && ` · ${line.attributes.map((attribute) => attribute.value).join(', ')}`}
                        </p>
                      </div>
                      <span className="text-xs font-bold tabular-nums text-stone-900">
                        {formatMoneyVND(Number(line.merchandise.price.amount) * line.quantity)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 border-t border-stone-200/80 pt-4 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Tạm tính</span>
                  <span className="font-semibold tabular-nums text-stone-900">{formatMoneyVND(subtotal)}</span>
                </div>
                {voucher && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Mã {voucher.code}</span>
                    <span className="font-semibold tabular-nums">-{formatMoneyVND(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-600">
                  <span>VAT {Math.round(TAX_RATE * 100)}%</span>
                  <span className="font-semibold tabular-nums text-stone-900">{formatMoneyVND(vat)}</span>
                </div>
                <div className="flex justify-between border-t border-stone-200/80 pt-3 text-sm font-bold text-stone-900">
                  <span>Tổng thanh toán</span>
                  <span className="text-lg font-extrabold tabular-nums text-[#3E2723]">{formatMoneyVND(total)}</span>
                </div>
              </div>

              <Button
                type="submit"
                disabled={pending || lineItems.length === 0}
                className="h-12 w-full cursor-pointer rounded-xl bg-[#3E2723] text-sm font-bold text-white shadow-md transition-all hover:bg-[#2b1b18]"
              >
                {pending ? 'Đang gửi đơn hàng...' : 'Xác nhận đặt hàng'}
              </Button>
              <p className="text-center text-[10px] leading-tight text-stone-400">
                Tổng tiền cuối cùng do hệ thống của quán tính khi xác nhận đơn.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
