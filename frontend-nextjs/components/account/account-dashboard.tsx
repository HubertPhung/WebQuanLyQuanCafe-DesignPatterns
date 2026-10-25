'use client'

import Link from 'next/link'
import { signOut } from '@/app/auth/actions'
import { Logo } from '@/components/brand/logo'
import { ReservationHistory } from './reservation-history'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Copy,
  Gift,
  Heart,
  LogOut,
  MapPin,
  Receipt,
  Settings,
  Sparkles,
  User,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { AccountOrder, AccountOverview } from '@/lib/account/queries'
import { nextRank, rankInfo } from '@/lib/account/loyalty'
import { VOUCHERS } from '@/lib/storefront/vouchers'

export type AccountUser = { name: string; email: string }

const vnd = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')} đ`

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function orderStatus(order: AccountOrder) {
  if (order.status === 'cancelled') return 'Đã hủy'
  if (order.status === 'pending') return 'Chờ pha chế'
  if (order.status === 'brewing') return 'Đang pha chế'
  if (order.status === 'ready') return order.fulfilment === 'delivery' ? 'Đang giao' : 'Chờ bạn đến lấy'
  return 'Đã hoàn thành'
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(-2)
    .join('')
    .toUpperCase()
}

// Khu vực tài khoản khách hàng: người dùng đang đăng nhập, đơn online và địa chỉ của họ, cùng hạng
// thành viên của số điện thoại trong đơn gần nhất (tất cả do trang server nạp).
export function AccountDashboard({
  user,
  currentTab,
  overview,
}: {
  user: AccountUser
  currentTab: string
  overview: AccountOverview
}) {
  const availableVouchers = VOUCHERS.filter(voucher => voucher.code !== 'WELCOME10' || overview.welcomeVoucherEligible)
  const copyVoucher = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success(`Đã sao chép mã ưu đãi ${code}!`)
  }
  const { member } = overview
  const tier = member ? rankInfo(member.rank) : null
  const upcoming = member ? nextRank(member.totalSpent) : null

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 font-sans pb-16">
      {/* Phần đầu trang */}
      <header className="border-b border-stone-200/80 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <ArrowLeft className="size-4 text-stone-500 group-hover:text-stone-900 transition-colors" />
            <span className="text-xs font-semibold text-stone-600 group-hover:text-stone-900">
              Về trang chủ Đà Lạt Cafe
            </span>
          </Link>
          <Logo markClassName="size-8" tagline="Tài khoản của bạn" />
          <form action={signOut}>
            <Button type="submit" variant="ghost" className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
              <LogOut className="size-3.5 mr-1" />
              Đăng xuất
            </Button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Thanh bên trái: thẻ hồ sơ và các tab điều hướng */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs text-center space-y-4">
              <Avatar className="size-20 mx-auto border-3 border-amber-200 shadow-sm">
                <AvatarFallback className="bg-[#3E2723] text-amber-100 font-bold text-xl">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>

              <div>
                <h2 className="text-lg font-bold text-stone-900">{user.name}</h2>
                <p className="text-xs text-stone-500 break-all">{user.email}</p>
              </div>

              {/* Ô hạng thành viên: Java xếp hạng theo tổng chi tiêu; điểm đến từ các đơn đã thanh toán. */}
              <div className="rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/60 p-3.5 border border-amber-200/70 text-left space-y-1.5">
                {member && tier ? (
                  <>
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                      <span className="flex items-center gap-1.5">
                        <Award className="size-4 text-amber-700" />
                        {tier.label}
                      </span>
                      <Badge className="bg-amber-600 text-white text-[10px] tabular-nums">{member.points.toLocaleString('vi-VN')} điểm</Badge>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      {upcoming
                        ? `Chi tiêu thêm ${vnd(upcoming.remaining)} để lên ${upcoming.label} (giảm ${Math.round(upcoming.discount * 100)}% khi thanh toán).`
                        : `Bạn đang ở hạng cao nhất, giảm ${Math.round(tier.discount * 100)}% khi thanh toán.`}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <Award className="size-4 text-amber-700" />
                      Chưa là hội viên
                    </div>
                    <p className="text-[11px] text-amber-800">
                      {overview.memberUnknown
                        ? 'Chưa đọc được điểm thành viên lúc này, hãy thử lại sau.'
                        : 'Đơn online thanh toán trước (VietQR, thẻ) sẽ đăng ký hội viên theo số điện thoại và tích điểm. Đơn trả khi nhận hàng không tích điểm.'}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Các tab điều hướng */}
            <nav className="rounded-2xl border border-stone-200/80 bg-white p-2 shadow-xs space-y-1 text-xs font-semibold">
              <Link
                href="/account/orders"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  currentTab === 'orders'
                    ? 'bg-[#3E2723] text-white shadow-xs'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Receipt className="size-4" />
                <span>Lịch sử đơn hàng & đặt bàn</span>
              </Link>

              <Link
                href="/account/vouchers"
                className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                  currentTab === 'vouchers'
                    ? 'bg-[#3E2723] text-white shadow-xs'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Gift className="size-4" />
                  <span>Voucher của tôi</span>
                </div>
                <Badge className="bg-amber-100 text-amber-800 text-[10px]">{availableVouchers.length} mã</Badge>
              </Link>

              <Link
                href="/account/addresses"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  currentTab === 'addresses'
                    ? 'bg-[#3E2723] text-white shadow-xs'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <MapPin className="size-4" />
                <span>Sổ địa chỉ</span>
              </Link>

              <Link
                href="/account/settings"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  currentTab === 'settings'
                    ? 'bg-[#3E2723] text-white shadow-xs'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Settings className="size-4" />
                <span>Cài đặt tài khoản</span>
              </Link>

              <Link
                href="/account/security"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-stone-700 hover:bg-stone-100"
              >
                <User className="size-4" />
                <span>Mật khẩu & bảo mật</span>
              </Link>
            </nav>
          </div>

          {/* Khung nội dung chính bên phải */}
          <div className="lg:col-span-8 space-y-6">
            {/* TAB: ĐƠN HÀNG */}
            {currentTab === 'orders' && (
              <>
              <ReservationHistory reservations={overview.reservations} unavailable={overview.reservationsUnavailable} />
              <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-5">
                <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                  <Receipt className="size-5 text-[#3E2723]" />
                  <span>Lịch sử đơn hàng gần đây</span>
                </h3>

                {overview.orders.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-xs text-stone-500">
                    Bạn chưa có đơn online nào.{' '}
                    <Link href="/#menu" className="font-semibold text-[#3E2723] underline underline-offset-2">
                      Xem menu
                    </Link>
                  </p>
                ) : (
                  <div className="space-y-3.5">
                    {overview.orders.map((order) => (
                      <div
                        key={order.orderCode}
                        className="rounded-xl border border-stone-200/80 p-4 hover:border-amber-300 transition-all space-y-2 bg-stone-50/40"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono font-bold text-stone-900">#{order.orderCode}</span>
                          <span className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[11px] font-semibold">
                              {order.refunded ? 'Đã ghi nhận hoàn tiền' : order.paid ? 'Đã thanh toán' : order.status === 'cancelled' ? 'Chưa thu tiền' : 'Trả khi nhận hàng'}
                            </Badge>
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-[11px]">
                              {orderStatus(order)}
                            </Badge>
                          </span>
                        </div>
                        <p className="text-xs text-stone-700 font-medium">{order.items}</p>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-200/60">
                          <span className="text-stone-500">
                            {dateTime(order.createdAt)} · {order.fulfilment === 'delivery' ? 'Giao hàng' : 'Tự đến lấy'}
                          </span>
                          <strong className="text-sm font-extrabold text-[#3E2723] tabular-nums">{vnd(order.total)}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </>
            )}

            {/* TAB: VOUCHER */}
            {currentTab === 'vouchers' && (
              <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-5">
                <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                  <Gift className="size-5 text-amber-600" />
                  <span>Kho voucher & Mã giảm giá</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {availableVouchers.length === 0 && <p className="text-sm text-stone-500">Chưa có voucher khả dụng. WELCOME10 chỉ dành cho đơn online đầu tiên của tài khoản mới.</p>}
                  {availableVouchers.map((v) => (
                    <div
                      key={v.code}
                      className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 space-y-2 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-[#3E2723] bg-white px-2.5 py-0.5 rounded-md border border-amber-300">
                          {v.code}
                        </span>
                        <button
                          onClick={() => copyVoucher(v.code)}
                          className="text-stone-500 hover:text-stone-900 p-1 rounded"
                          title="Sao chép mã"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      </div>
                      <h4 className="text-xs font-bold text-stone-900">{v.title}</h4>
                      <p className="text-[11px] text-stone-600">{v.terms}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: ĐỊA CHỈ */}
            {currentTab === 'addresses' && (
              <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-5">
                <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                  <MapPin className="size-5 text-[#3E2723]" />
                  <span>Sổ địa chỉ nhận hàng</span>
                </h3>

                {overview.addresses.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-xs text-stone-500">
                    Địa chỉ bạn dùng khi đặt giao hàng sẽ hiện ở đây.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {overview.addresses.map((entry, index) => (
                      <div
                        key={entry.address}
                        className={`rounded-xl p-4 space-y-1.5 ${index === 0 ? 'border-2 border-[#3E2723] bg-amber-50/20' : 'border border-stone-200'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-900">Dùng lần cuối {dateTime(entry.lastUsed)}</span>
                          {index === 0 && <Badge className="bg-[#3E2723] text-white text-[10px]">Gần nhất</Badge>}
                        </div>
                        <p className="text-xs text-stone-700 font-semibold">
                          {user.name} · {entry.phone}
                        </p>
                        <p className="text-xs text-stone-500">{entry.address}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: CÀI ĐẶT */}
            {currentTab === 'settings' && (
              <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-5">
                <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                  <Settings className="size-5 text-[#3E2723]" />
                  <span>Cài đặt thông tin tài khoản</span>
                </h3>

                <dl className="space-y-4 text-xs">
                  {[
                    ['Họ và tên', user.name],
                    ['Email đăng nhập', user.email],
                    ['Số điện thoại tích điểm', overview.phone ?? 'Chưa có (lấy từ đơn online gần nhất)'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-stone-500 mb-1 font-medium">{label}</dt>
                      <dd className="rounded-xl border border-stone-200 bg-stone-50/60 p-2.5 font-semibold text-stone-900 break-all">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-[11px] text-stone-500">
                  Tên và email do tài khoản đăng nhập quản lý.{' '}
                  <Link href="/account/security" className="font-semibold text-[#3E2723] underline underline-offset-2">
                    Đổi mật khẩu
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

