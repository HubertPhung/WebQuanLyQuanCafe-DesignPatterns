'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  Coffee,
  CreditCard,
  MapPin,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Truck,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCartStore, formatMoneyVND } from '@/lib/store/cart-store'
import { toast } from 'sonner'

export default function CheckoutPage() {
  const router = useRouter()
  const { cart } = useCartStore()

  const [paymentMethod, setPaymentMethod] = useState<'vietqr' | 'cod' | 'card'>('vietqr')
  const [shippingMethod, setShippingMethod] = useState<'express' | 'standard'>('express')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const lineItems = cart?.lines?.nodes ?? []
  const subtotal = Number(cart?.cost?.subtotalAmount?.amount ?? '0')
  const shippingFee = shippingMethod === 'express' ? 15000 : 0
  const isDiscounted = cart?.discountCodes?.some((d) => d.applicable)
  const discountAmount = isDiscounted ? subtotal * 0.1 : 0
  const total = Math.max(0, subtotal - discountAmount + shippingFee)

  const handlePlaceOrder = () => {
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSuccess(true)
      toast.success('Đặt hàng thành công! Barista đang chuẩn bị cà phê cho bạn.')
    }, 1200)
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-stone-900 font-sans flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-white p-8 border border-stone-200/80 shadow-xl text-center space-y-5">
          <div className="size-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="size-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-stone-900">Đặt hàng thành công!</h2>
            <p className="text-xs text-stone-500 leading-relaxed">
              Mã đơn hàng: <strong className="text-stone-900 font-mono">#AC-{Date.now().toString().slice(-6)}</strong>
            </p>
            <p className="text-xs text-stone-600">
              Cảm ơn bạn <strong className="text-stone-900">Phùng Hoài Bo</strong> đã lựa chọn Đà Lạt Cafe. Barista đang bắt đầu xay hạt và chiết xuất ly cà phê thơm ngon nhất.
            </p>
          </div>

          <div className="rounded-2xl bg-amber-50/60 p-4 border border-amber-200/60 text-left space-y-2 text-xs">
            <div className="flex justify-between font-semibold text-stone-700">
              <span>Phương thức thanh toán:</span>
              <span className="text-[#3E2723]">
                {paymentMethod === 'vietqr' ? 'VietQR Chuyển khoản' : paymentMethod === 'cod' ? 'Tiền mặt khi nhận' : 'Thẻ quốc tế'}
              </span>
            </div>
            <div className="flex justify-between font-bold text-stone-900 text-sm pt-1 border-t border-amber-200/40">
              <span>Tổng thanh toán:</span>
              <span className="text-[#3E2723]">{formatMoneyVND(total)}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <Button
              onClick={() => router.push('/account/orders')}
              className="w-full rounded-xl bg-[#3E2723] hover:bg-[#2b1b18] text-white font-bold text-xs h-11"
            >
              Xem lịch sử đơn hàng
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/')}
              className="w-full rounded-xl border-stone-300 text-stone-700 text-xs h-11 font-medium"
            >
              Tiếp tục khám phá thực đơn
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 font-sans pb-16">
      {/* Top Header */}
      <header className="border-b border-stone-200/80 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <ArrowLeft className="size-4 text-stone-500 group-hover:text-stone-900 transition-colors" />
            <span className="text-xs font-semibold text-stone-600 group-hover:text-stone-900">
              Quay lại cửa hàng
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-[#3E2723] text-white flex items-center justify-center">
              <Coffee className="size-4.5" />
            </div>
            <span className="font-extrabold text-base text-stone-900">Đà Lạt Cafe Checkout</span>
          </div>
          <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            🔒 Bảo mật 256-bit
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Information & Options */}
          <div className="lg:col-span-7 space-y-6">
            {/* Customer Details */}
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-stone-900 flex items-center gap-2">
                  <User className="size-4.5 text-[#3E2723]" />
                  <span>Thông tin khách hàng & Giao nhận</span>
                </h3>
                <Badge variant="outline" className="text-amber-800 bg-amber-50 border-amber-200 font-semibold text-[11px]">
                  Hạng Vàng
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-stone-500 mb-1 font-medium">Họ và tên</label>
                  <input
                    type="text"
                    defaultValue="Phùng Hoài Bo"
                    className="w-full rounded-xl border border-stone-200 p-2.5 font-semibold text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
                  />
                </div>
                <div>
                  <label className="block text-stone-500 mb-1 font-medium">Số điện thoại</label>
                  <input
                    type="text"
                    defaultValue="0908 123 456"
                    className="w-full rounded-xl border border-stone-200 p-2.5 font-semibold text-stone-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-stone-500 mb-1 font-medium">Email xác nhận</label>
                  <input
                    type="email"
                    defaultValue="hoaibo.phung@gmail.com"
                    className="w-full rounded-xl border border-stone-200 p-2.5 font-semibold text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-stone-500 mb-1 font-medium">Địa chỉ nhận hàng</label>
                  <input
                    type="text"
                    defaultValue="123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh"
                    className="w-full rounded-xl border border-stone-200 p-2.5 font-semibold text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Methods */}
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-4">
              <h3 className="font-bold text-base text-stone-900 flex items-center gap-2">
                <Truck className="size-4.5 text-[#3E2723]" />
                <span>Phương thức vận chuyển</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <label
                  onClick={() => setShippingMethod('express')}
                  className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                    shippingMethod === 'express'
                      ? 'border-[#3E2723] bg-amber-50/40 ring-1 ring-[#3E2723]'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shipping"
                      checked={shippingMethod === 'express'}
                      onChange={() => setShippingMethod('express')}
                      className="accent-[#3E2723]"
                    />
                    <div>
                      <strong className="block font-bold text-stone-900">Giao hỏa tốc 30 phút</strong>
                      <span className="text-stone-500 text-[11px]">Bảo toàn độ tươi nóng và đá tan tối thiểu</span>
                    </div>
                  </div>
                  <span className="font-bold tabular-nums text-stone-900">15.000 đ</span>
                </label>

                <label
                  onClick={() => setShippingMethod('standard')}
                  className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                    shippingMethod === 'standard'
                      ? 'border-[#3E2723] bg-amber-50/40 ring-1 ring-[#3E2723]'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shipping"
                      checked={shippingMethod === 'standard'}
                      onChange={() => setShippingMethod('standard')}
                      className="accent-[#3E2723]"
                    />
                    <div>
                      <strong className="block font-bold text-stone-900">Giao tiêu chuẩn (1-2 giờ)</strong>
                      <span className="text-stone-500 text-[11px]">Thích hợp cho hạt rang và bánh ngọt</span>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-700">Miễn phí</span>
                </label>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-4">
              <h3 className="font-bold text-base text-stone-900 flex items-center gap-2">
                <CreditCard className="size-4.5 text-[#3E2723]" />
                <span>Phương thức thanh toán</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <label
                  onClick={() => setPaymentMethod('vietqr')}
                  className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'vietqr'
                      ? 'border-[#3E2723] bg-sky-50/40 ring-1 ring-[#3E2723]'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'vietqr'}
                      onChange={() => setPaymentMethod('vietqr')}
                      className="accent-[#3E2723]"
                    />
                    <div>
                      <strong className="block font-bold text-stone-900">VietQR Napas 24/7 (Khuyên dùng)</strong>
                      <span className="text-stone-500 text-[11px]">Quét mã QR qua mọi app ngân hàng & ví điện tử</span>
                    </div>
                  </div>
                  <Badge className="bg-[#005ba6] text-white text-[10px]">Tức thì</Badge>
                </label>

                <label
                  onClick={() => setPaymentMethod('cod')}
                  className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'cod'
                      ? 'border-[#3E2723] bg-amber-50/40 ring-1 ring-[#3E2723]'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                      className="accent-[#3E2723]"
                    />
                    <div>
                      <strong className="block font-bold text-stone-900">Thanh toán tiền mặt khi nhận (COD)</strong>
                      <span className="text-stone-500 text-[11px]">Thanh toán trực tiếp cho shipper</span>
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'card'
                      ? 'border-[#3E2723] bg-amber-50/40 ring-1 ring-[#3E2723]'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'card'}
                      onChange={() => setPaymentMethod('card')}
                      className="accent-[#3E2723]"
                    />
                    <div>
                      <strong className="block font-bold text-stone-900">Thẻ Visa / Mastercard / JCB</strong>
                      <span className="text-stone-500 text-[11px]">Bảo mật qua cổng thanh toán quốc tế</span>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs sticky top-24 space-y-5">
              <h3 className="font-bold text-base text-stone-900 flex items-center justify-between">
                <span>Đơn hàng của bạn</span>
                <span className="text-xs font-normal text-stone-500">
                  {cart?.totalQuantity ?? 0} sản phẩm
                </span>
              </h3>

              {/* Items List */}
              <div className="divide-y divide-stone-100 max-h-64 overflow-y-auto pr-1">
                {lineItems.length === 0 ? (
                  <p className="text-xs text-stone-500 py-4 text-center">Giỏ hàng chưa có sản phẩm nào</p>
                ) : (
                  lineItems.map((line) => {
                    const price = Number(line.merchandise.price.amount) * line.quantity
                    return (
                      <div key={line.id} className="py-3 flex items-center gap-3">
                        {line.merchandise.product.featuredImage?.url ? (
                          <img
                            src={line.merchandise.product.featuredImage.url}
                            alt={line.merchandise.product.title}
                            className="size-12 rounded-lg object-cover border border-stone-100"
                          />
                        ) : (
                          <div className="size-12 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400">
                            <ShoppingBag className="size-5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 text-xs">
                          <p className="font-bold text-stone-900 truncate">
                            {line.merchandise.product.title}
                          </p>
                          <p className="text-stone-500 text-[11px]">
                            {line.merchandise.title} x {line.quantity}
                          </p>
                        </div>
                        <span className="font-bold text-xs tabular-nums text-stone-900">
                          {formatMoneyVND(price)}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Bill breakdown */}
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
                  <span className="font-semibold tabular-nums text-stone-900">
                    {shippingFee === 0 ? 'Miễn phí' : formatMoneyVND(shippingFee)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-stone-200/80 pt-3 text-sm font-bold text-stone-900">
                  <span>Tổng thanh toán</span>
                  <span className="tabular-nums text-lg text-[#3E2723] font-extrabold">
                    {formatMoneyVND(total)}
                  </span>
                </div>
              </div>

              {/* Order Button */}
              <Button
                disabled={isSubmitting || lineItems.length === 0}
                onClick={handlePlaceOrder}
                className="w-full h-12 rounded-xl bg-[#3E2723] hover:bg-[#2b1b18] text-white font-bold text-sm shadow-md cursor-pointer transition-all"
              >
                {isSubmitting ? 'Đang gửi đơn hàng...' : 'Xác nhận đặt hàng'}
              </Button>

              <p className="text-[10px] text-stone-400 text-center leading-tight">
                Nhấn đặt hàng đồng nghĩa với việc bạn đồng ý với Điều khoản dịch vụ và Chính sách giao hàng của Đà Lạt Cafe.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

