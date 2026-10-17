'use client'

import Link from 'next/link'
import { signOut } from '@/app/auth/actions'
import { Logo } from '@/components/brand/logo'
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

export type AccountUser = { name: string; email: string }

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(-2)
    .join('')
    .toUpperCase()
}

// Customer account area. The signed-in user comes from the server page; orders, vouchers and
// addresses are still sample data.
export function AccountDashboard({ user, currentTab }: { user: AccountUser; currentTab: string }) {
  const copyVoucher = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success(`Đã sao chép mã ưu đãi ${code}!`)
  }


  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 font-sans pb-16">
      {/* Top Header */}
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
          {/* Left Sidebar: Profile Card & Navigation Tabs */}
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

              {/* Loyalty Tier Box */}
              <div className="rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/60 p-3.5 border border-amber-200/70 text-left space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                  <span className="flex items-center gap-1.5">
                    <Award className="size-4 text-amber-700" />
                    Hạng Vàng
                  </span>
                  <Badge className="bg-amber-600 text-white text-[10px] tabular-nums">
                    350 Điểm
                  </Badge>
                </div>
                <p className="text-[11px] text-amber-800">
                  Tích thêm 150 điểm để nâng hạng Kim Cương và nhận ưu đãi giảm 15% trọn đời.
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
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
                <span>Lịch sử đơn hàng</span>
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
                <Badge className="bg-amber-100 text-amber-800 text-[10px]">3 mã</Badge>
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

          {/* Right Main Content Panel */}
          <div className="lg:col-span-8">
            {/* TAB: ORDERS */}
            {currentTab === 'orders' && (
              <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-5">
                <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                  <Receipt className="size-5 text-[#3E2723]" />
                  <span>Lịch sử đơn hàng gần đây</span>
                </h3>

                <div className="space-y-3.5">
                  {[
                    {
                      id: '#AC-0921',
                      date: '13/10/2026 · 14:30',
                      items: 'Vanilla Velvet Latte (x1), Croissant Bơ Hạnh Nhân (x1)',
                      status: 'Đã hoàn thành',
                      total: '100.000 đ',
                    },
                    {
                      id: '#AC-0844',
                      date: '10/10/2026 · 08:15',
                      items: 'Cà phê Ủ Lạnh Nitro (x1)',
                      status: 'Đã hoàn thành',
                      total: '58.000 đ',
                    },
                    {
                      id: '#AC-0712',
                      date: '02/10/2026 · 16:45',
                      items: 'Pour Over Guji Ethiopia (x1), Hạt House Blend 250g (x1)',
                      status: 'Đã hoàn thành',
                      total: '245.000 đ',
                    },
                  ].map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl border border-stone-200/80 p-4 hover:border-amber-300 transition-all space-y-2 bg-stone-50/40"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-stone-900">{order.id}</span>
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-[11px]">
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-stone-700 font-medium">{order.items}</p>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-200/60">
                        <span className="text-stone-500">{order.date}</span>
                        <strong className="text-sm font-extrabold text-[#3E2723] tabular-nums">
                          {order.total}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: VOUCHERS */}
            {currentTab === 'vouchers' && (
              <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-5">
                <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                  <Gift className="size-5 text-amber-600" />
                  <span>Kho voucher & Mã giảm giá</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      code: 'WELCOME10',
                      title: 'Giảm 10% đơn hàng đầu',
                      desc: 'Áp dụng cho toàn bộ đồ uống trên menu',
                      expiry: 'Hạn dùng: 31/12/2026',
                    },
                    {
                      code: 'GOLDVIP',
                      title: 'Giảm 20.000 đ',
                      desc: 'Dành riêng cho khách hàng Hạng Vàng đơn từ 100k',
                      expiry: 'Hạn dùng: 15/11/2026',
                    },
                    {
                      code: 'FREESHIP',
                      title: 'Miễn phí giao hàng hỏa tốc',
                      desc: 'Bán kính 5km nội thành TP.HCM',
                      expiry: 'Hạn dùng: 30/11/2026',
                    },
                  ].map((v) => (
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
                      <p className="text-[11px] text-stone-600">{v.desc}</p>
                      <span className="text-[10px] text-stone-400 block pt-1">{v.expiry}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: ADDRESSES */}
            {currentTab === 'addresses' && (
              <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-5">
                <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                  <MapPin className="size-5 text-[#3E2723]" />
                  <span>Sổ địa chỉ nhận hàng</span>
                </h3>

                <div className="space-y-3">
                  <div className="rounded-xl border-2 border-[#3E2723] p-4 bg-amber-50/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900">Địa chỉ nhà riêng (Mặc định)</span>
                      <Badge className="bg-[#3E2723] text-white text-[10px]">Mặc định</Badge>
                    </div>
                    <p className="text-xs text-stone-700 font-semibold">Phùng Hoài Bo · 0908 123 456</p>
                    <p className="text-xs text-stone-500">
                      123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh
                    </p>
                  </div>

                  <div className="rounded-xl border border-stone-200 p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900">Văn phòng công ty</span>
                    </div>
                    <p className="text-xs text-stone-700 font-semibold">Phùng Hoài Bo · 0908 123 456</p>
                    <p className="text-xs text-stone-500">
                      Tòa nhà Bitexco, 2 Hải Triều, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SETTINGS */}
            {currentTab === 'settings' && (
              <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-5">
                <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                  <Settings className="size-5 text-[#3E2723]" />
                  <span>Cài đặt thông tin tài khoản</span>
                </h3>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-stone-500 mb-1 font-medium">Họ và tên</label>
                    <input
                      type="text"
                      defaultValue={user.name}
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
                  <div>
                    <label className="block text-stone-500 mb-1 font-medium">Email</label>
                    <input
                      type="email"
                      defaultValue="hoaibo.phung@gmail.com"
                      className="w-full rounded-xl border border-stone-200 p-2.5 font-semibold text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
                    />
                  </div>
                  <div className="pt-2">
                    <Button
                      onClick={() => toast.success('Đã lưu thông tin tài khoản thành công!')}
                      className="rounded-xl bg-[#3E2723] hover:bg-[#2b1b18] text-white font-semibold text-xs h-10 px-5 cursor-pointer"
                    >
                      Lưu thay đổi
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

