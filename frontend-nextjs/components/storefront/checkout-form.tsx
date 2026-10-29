'use client'

import { localImageSrc } from '@/lib/assets'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Coffee,
  CreditCard,
  ShoppingBag,
  Store,
  Truck,
  User,
  QrCode,
  Check,
  Copy,
  Sparkles,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { placeOnlineOrder, type OnlineOrderInput } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/logo'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { TAX_RATE } from '@/lib/admin/format'
import { formatMoneyVND, useCartStore } from '@/lib/store/cart-store'
import { isDaLatAddress, shippingFee } from '@/lib/storefront/delivery'
import { DEFAULT_BRANCH_ID, branchById, branches, type BranchId } from '@/lib/branches'

type Payment = OnlineOrderInput['payment']
type Fulfilment = OnlineOrderInput['fulfilment']
type Placed = { orderCode: string; total: number; paid: boolean; name: string; payment: Payment; fulfilment: Fulfilment; branch: BranchId }

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
  const [branch, setBranch] = useState<BranchId>(DEFAULT_BRANCH_ID)
  const [payment, setPayment] = useState<Payment>('vietqr')
  const [placed, setPlaced] = useState<Placed | null>(null)
  const [pending, startTransition] = useTransition()

  // Hộp thoại thanh toán demo
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [isCardModalOpen, setIsCardModalOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  // Trạng thái thẻ demo
  const [cardNumber, setCardNumber] = useState('5412 7512 3412 8899')
  const [cardHolder, setCardHolder] = useState(account?.name?.toUpperCase() || 'NGUYEN VAN AN')
  const [cardExpiry, setCardExpiry] = useState('12/28')
  const [cardCvv, setCardCvv] = useState('888')
  const [isProcessingCard, setIsProcessingCard] = useState(false)

  const lineItems = cart?.lines?.nodes ?? []
  const subtotal = Number(cart?.cost?.subtotalAmount?.amount ?? '0')
  const voucher = cart?.discountCodes?.find((code) => code.applicable)
  // Giỏ hàng đã hỏi Java mức giảm của mã (đơn tối thiểu, mức tối đa): tổng sau giảm là số đó.
  const discount = voucher ? Math.max(0, subtotal - Number(cart?.cost?.totalAmount?.amount ?? subtotal)) : 0
  const vat = Math.round((subtotal - discount) * TAX_RATE)
  const deliveryFee = shippingFee(fulfilment)
  const total = subtotal - discount + vat + deliveryFee

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setIsCopied(true)
    toast.success('Đã sao chép vào bộ nhớ tạm!')
    setTimeout(() => setIsCopied(false), 2000)
  }

  const executePlaceOrder = (chosenPayment: Payment) => {
    startTransition(async () => {
      const result = await placeOnlineOrder({ name, phone, email, address, note, fulfilment, branch, payment: chosenPayment })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setIsQrModalOpen(false)
      setIsCardModalOpen(false)
      setPlaced({ ...result, name, payment: chosenPayment, fulfilment, branch })
      await fetchCart()
      toast.success('Đơn hàng đã được xác nhận thành công!')
    })
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      toast.error('Vui lòng nhập họ và tên người nhận.')
      return
    }
    if (!phone.trim()) {
      toast.error('Vui lòng nhập số điện thoại người nhận.')
      return
    }
    if (fulfilment === 'delivery' && !isDaLatAddress(address)) {
      toast.error('Quán chỉ giao trong Đà Lạt. Vui lòng ghi Đà Lạt hoặc ĐL trong địa chỉ, hoặc chọn tự đến lấy.')
      return
    }

    if (payment === 'vietqr') {
      setIsQrModalOpen(true)
    } else if (payment === 'card') {
      setIsCardModalOpen(true)
    } else {
      executePlaceOrder('cod')
    }
  }

  const handleConfirmCardPayment = () => {
    setIsProcessingCard(true)
    setTimeout(() => {
      setIsProcessingCard(false)
      executePlaceOrder('card')
    }, 1200)
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
              {placed.fulfilment === 'delivery'
                ? ` và chi nhánh ${branchById(placed.branch).street} sẽ giao tới địa chỉ bạn đã nhập.`
                : `; bạn có thể ghé quầy ${branchById(placed.branch).street} lấy khi đồ uống sẵn sàng.`}
            </p>
          </div>
          <div className="space-y-2 rounded-2xl border border-amber-200/60 bg-amber-50/60 p-4 text-left text-xs">
            <div className="flex justify-between font-semibold text-stone-700">
              <span>Phương thức thanh toán:</span>
              <span className="text-[#3E2723]">{paymentLabels[placed.payment]}</span>
            </div>
            <div className="flex justify-between font-semibold text-stone-700">
              <span>Trạng thái:</span>
              <span className={placed.paid ? 'text-emerald-700 font-bold' : 'text-amber-800'}>
                {placed.paid ? '✓ Đã thanh toán trực tuyến' : 'Thanh toán khi nhận'}
              </span>
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
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity" title="Về trang chủ Đà Lạt Cafe">
            <Logo markClassName="size-8 sm:size-9" tagline="Thanh toán an toàn" />
          </Link>
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
                  aside={<span className="font-bold text-emerald-700">{formatMoneyVND(shippingFee('delivery'))}</span>}
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
              <div className="space-y-2 text-xs">
                <span className="block font-medium text-stone-500">
                  {fulfilment === 'delivery' ? 'Chi nhánh pha chế và giao hàng' : 'Chi nhánh đến lấy'}
                </span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {branches.map((option) => (
                    <Choice
                      key={option.id}
                      name="branch"
                      checked={branch === option.id}
                      onSelect={() => setBranch(option.id)}
                      title={option.street}
                      hint={`${option.hours} · ${option.note}`}
                    />
                  ))}
                </div>
              </div>
              {fulfilment === 'delivery' && (
                <div className="text-xs">
                  <label htmlFor="checkout-address" className="mb-1 block font-medium text-stone-500">Địa chỉ nhận hàng</label>
                  <input id="checkout-address" required minLength={8} maxLength={200} autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 Trần Phú, Phường Xuân Hương, Đà Lạt" className={inputClass} />
                  <p className="mt-2 text-stone-500">Chỉ giao trong Đà Lạt, phí cố định 10.000đ. Địa chỉ có thể ghi Đà Lạt, Da Lat, Dalat hoặc ĐL ở bất kỳ vị trí nào.</p>
                </div>
              )}
              <div className="text-xs">
                <label htmlFor="checkout-note" className="mb-1 block font-medium text-stone-500">Ghi chú cho quán (không bắt buộc)</label>
                <textarea id="checkout-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: gọi trước khi giao" className={inputClass} />
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-bold text-stone-900">
                  <CreditCard className="size-4.5 text-[#3E2723]" aria-hidden="true" />
                  <span>Phương thức thanh toán</span>
                </h3>
              </div>
              <div className="space-y-2.5 text-xs">
                <Choice
                  name="payment"
                  checked={payment === 'vietqr'}
                  onSelect={() => setPayment('vietqr')}
                  title="VietQR Napas 24/7"
                  hint="Xem mã QR và hướng dẫn chuyển khoản"
                  aside={
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setIsQrModalOpen(true)
                      }}
                      className="text-[11px] font-bold text-[#005ba6] hover:underline flex items-center gap-1 px-2 py-1 rounded bg-sky-50"
                    >
                      <QrCode className="size-3.5" /> Xem QR
                    </button>
                  }
                />
                <Choice
                  name="payment"
                  checked={payment === 'card'}
                  onSelect={() => setPayment('card')}
                  title="Thẻ Visa / Mastercard / JCB"
                  hint="Thanh toán thẻ quốc tế (Mở giao diện thẻ ảo Mastercard 3D)"
                  aside={
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setIsCardModalOpen(true)
                      }}
                      className="text-[11px] font-bold text-amber-900 hover:underline flex items-center gap-1 px-2 py-1 rounded bg-amber-50"
                    >
                      <CreditCard className="size-3.5" /> Xem thẻ
                    </button>
                  }
                />
                <Choice
                  name="payment"
                  checked={payment === 'cod'}
                  onSelect={() => setPayment('cod')}
                  title="Tiền mặt khi nhận hàng (COD)"
                  hint="Thanh toán khi nhận đồ uống tận nơi"
                />
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
                        <img src={localImageSrc(line.merchandise.product.featuredImage.url)} alt="" className="size-12 rounded-lg border border-stone-100 object-cover" />
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
                <div className="flex justify-between text-xs text-stone-500"><span>Phí giao hàng</span><span className="font-semibold text-stone-900">{formatMoneyVND(deliveryFee)}</span></div>
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
                {pending ? 'Đang gửi đơn hàng...' : payment === 'vietqr' ? 'Quét mã VietQR thanh toán' : payment === 'card' ? 'Thanh toán thẻ Mastercard' : 'Xác nhận đặt hàng (COD)'}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* 1. HỘP THOẠI THANH TOÁN DEMO VIETQR */}
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent className="max-w-md rounded-3xl border-stone-200 bg-white p-6 text-stone-900 shadow-2xl font-sans">
          <DialogHeader className="text-center sm:text-left">
            <div className="flex items-center justify-between mb-1">
              <Badge className="bg-[#005ba6] text-white text-xs px-2.5 py-0.5">
                VietQR · Chuyển khoản tức thì
              </Badge>
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Đang chờ quét mã
              </span>
            </div>
            <DialogTitle className="text-xl font-bold text-stone-900">
              Quét mã QR để thanh toán
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Mở ứng dụng ngân hàng bất kỳ (Vietcombank, MBBank, Techcombank, Momo, v.v.) và quét mã bên dưới:
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative rounded-2xl border-2 border-[#005ba6]/30 bg-slate-50 p-4 shadow-sm flex flex-col items-center w-full">
              {/* Khung mã QR mô phỏng */}
              <div className="size-48 bg-white border border-slate-200 rounded-xl p-2 flex items-center justify-center shadow-inner relative">
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
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="size-9 rounded-full bg-white shadow-md flex items-center justify-center border border-stone-200">
                    <Coffee className="size-5 text-[#3E2723]" />
                  </div>
                </div>
              </div>

              <div className="mt-3 text-center w-full">
                <p className="text-xs font-semibold text-stone-700">Ngân hàng TMCP Ngoại Thương (Vietcombank)</p>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  <span className="font-mono text-sm font-bold text-stone-900 tracking-wider">
                    0123 4567 8999
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('012345678999')}
                    className="p-1 hover:bg-stone-200 rounded text-stone-600 transition-colors cursor-pointer"
                    title="Sao chép số tài khoản"
                  >
                    {isCopied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5">Chủ TK: CONG TY TNHH DA LAT CAFE</p>
                <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs px-2">
                  <span className="text-stone-500">Số tiền cần trả:</span>
                  <span className="text-base font-extrabold text-[#3E2723] tabular-nums">
                    {formatMoneyVND(total)}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 text-center text-[11px] text-stone-500 leading-relaxed">
              Chưa kết nối xác nhận giao dịch ngân hàng. Nút xác nhận chỉ tạo đơn thử nghiệm, không xác minh tiền đã chuyển.
            </p>
          </div>

          <div className="mt-1 flex flex-col gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => executePlaceOrder('vietqr')}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer transition-all"
            >
              {pending ? 'Đang xác nhận...' : '✓ Tôi đã chuyển khoản thành công'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsQrModalOpen(false)}
              className="w-full text-xs text-stone-600 cursor-pointer"
            >
              Quay lại chỉnh sửa đơn hàng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. HỘP THOẠI THANH TOÁN DEMO MASTERCARD / VISA */}
      <Dialog open={isCardModalOpen} onOpenChange={setIsCardModalOpen}>
        <DialogContent className="max-w-md rounded-3xl border-stone-200 bg-white p-6 text-stone-900 shadow-2xl font-sans">
          <DialogHeader className="text-center sm:text-left">
            <div className="flex items-center justify-between mb-1">
              <Badge className="bg-amber-800 text-amber-100 text-xs px-2.5 py-0.5">
                Mastercard · Global Pay
              </Badge>
            </div>
            <DialogTitle className="text-xl font-bold text-stone-900">
              Thanh toán thẻ Mastercard / Visa
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Chưa kết nối cổng thanh toán thẻ. Chỉ dùng thông tin mẫu; dữ liệu này không được gửi tới ngân hàng.
            </DialogDescription>
          </DialogHeader>

          {/* Hình thẻ Mastercard ảo dạng 3D */}
          <div className="relative h-44 w-full rounded-2xl bg-gradient-to-tr from-stone-950 via-[#2c1b18] to-[#4E342E] p-5 text-white shadow-xl ring-1 ring-white/10 overflow-hidden font-mono flex flex-col justify-between my-2">
            <div className="absolute -right-8 -top-8 size-32 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />
            <div className="absolute -left-8 -bottom-8 size-32 rounded-full bg-red-500/10 blur-xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Chip kim loại */}
                <div className="size-7 rounded-sm bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-0.5 shadow-inner">
                  <div className="size-full border border-amber-900/40 rounded-xs grid grid-cols-2 gap-0.5" />
                </div>
                <span className="text-stone-400 text-[10px] tracking-widest font-sans">CONTACTLESS</span>
              </div>
              {/* Hai vòng tròn lồng nhau của Mastercard */}
              <div className="flex items-center -space-x-2">
                <div className="size-6 rounded-full bg-[#EB001B] opacity-95 shadow-sm" />
                <div className="size-6 rounded-full bg-[#F79E1B] opacity-95 shadow-sm" />
              </div>
            </div>

            <div>
              <p className="text-stone-400 text-[9px] uppercase font-sans tracking-wider">Card Number</p>
              <p className="text-base sm:text-lg font-bold tracking-widest text-amber-50 drop-shadow">
                {cardNumber || '•••• •••• •••• ••••'}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div>
                <p className="text-stone-400 text-[8px] uppercase font-sans">Cardholder</p>
                <p className="font-semibold text-stone-100 uppercase tracking-wider text-[11px] truncate max-w-[150px]">
                  {cardHolder || 'NGUYEN VAN AN'}
                </p>
              </div>
              <div>
                <p className="text-stone-400 text-[8px] uppercase font-sans text-right">Expires</p>
                <p className="font-semibold text-stone-100 tracking-wider text-[11px]">
                  {cardExpiry || '12/28'}
                </p>
              </div>
            </div>
          </div>

          {/* Các ô để sửa hoặc dùng dữ liệu giả */}
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[11px] font-medium text-stone-500 block mb-1">Số thẻ Mastercard</label>
              <input
                type="text"
                maxLength={19}
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="5412 7512 3412 8899"
                className="w-full h-9 px-3 rounded-xl border border-stone-200 font-mono text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-stone-500 block mb-1">Tên in trên thẻ</label>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                  placeholder="NGUYEN VAN AN"
                  className="w-full h-9 px-3 rounded-xl border border-stone-200 uppercase text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[11px] font-medium text-stone-500 block mb-1">Hết hạn</label>
                  <input
                    type="text"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="12/28"
                    className="w-full h-9 px-2 rounded-xl border border-stone-200 text-center text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-stone-500 block mb-1">CVV</label>
                  <input
                    type="password"
                    maxLength={3}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    placeholder="888"
                    className="w-full h-9 px-2 rounded-xl border border-stone-200 text-center text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setCardNumber('5412 7512 3412 8899')
                  setCardHolder(name.toUpperCase() || 'NGUYEN VAN AN')
                  setCardExpiry('12/28')
                  setCardCvv('888')
                  toast.success('Đã điền thông tin thẻ mẫu.')
                }}
                className="text-[11px] text-[#3E2723] hover:underline font-semibold cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="size-3 text-amber-600" /> Điền thông tin mẫu
              </button>
              <span className="text-[11px] font-bold text-stone-900">
                Tổng trừ thẻ: <strong className="text-amber-900">{formatMoneyVND(total)}</strong>
              </span>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <Button
              type="button"
              disabled={isProcessingCard || pending}
              onClick={handleConfirmCardPayment}
              className="w-full h-11 rounded-xl bg-[#3E2723] hover:bg-[#2b1b18] text-white font-bold text-xs shadow-md cursor-pointer transition-all"
            >
              {isProcessingCard ? 'Đang xử lý yêu cầu...' : `Xác nhận thanh toán ${formatMoneyVND(total)}`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCardModalOpen(false)}
              className="w-full text-xs text-stone-600 cursor-pointer"
            >
              Quay lại
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default CheckoutForm
