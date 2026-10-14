'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Check, ChevronsUpDown, Coffee, LogOut, Search, Store, UserCheck } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { toast } from 'sonner'

type HeaderProps = {
  lowStock?: { id: number; name: string; stockQty: number; unit: string }[]
  readyOrders?: { id: number; orderCode: string; customer: string }[]
  activeCount?: number
}

export function AdminHeader({
  lowStock = [],
  readyOrders = [],
  activeCount = 0,
}: HeaderProps) {
  const router = useRouter()
  const notificationCount = lowStock.length + readyOrders.length

  return (
    <header className="sticky top-0 z-20 flex h-20 shrink-0 items-center gap-3 border-b border-stone-200/50 bg-[#F7F5F0]/90 backdrop-blur-md px-4 md:px-8 text-stone-900 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <SidebarTrigger className="h-10 w-10 rounded-lg bg-white border border-stone-200/50 hover:bg-stone-100 text-stone-700 hover:text-stone-900 shadow-2xs flex-shrink-0 flex items-center justify-center" />
      <Separator orientation="vertical" className="h-5 bg-stone-200 flex-shrink-0" />

      {/* Branch selector */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="hidden sm:flex h-10 rounded-lg px-3.5 text-xs md:text-sm font-semibold border border-stone-200/80 bg-white hover:bg-stone-50 gap-2 items-center cursor-pointer transition-colors shadow-2xs whitespace-nowrap min-w-fit flex-shrink-0"
        >
          <Store className="size-4 text-[#5A3E2B]" />
          <span className="font-semibold tracking-tight text-stone-800 whitespace-nowrap">Chi nhánh 1 · Trung tâm</span>
          <ChevronsUpDown className="size-3.5 text-stone-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 p-1.5 rounded-xl bg-white border-stone-200 text-stone-900 shadow-xl">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-stone-500 px-3 py-2 whitespace-nowrap">
              Chi nhánh cửa hàng
            </DropdownMenuLabel>
            <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm font-medium hover:bg-stone-100 text-stone-900 cursor-pointer whitespace-nowrap">
              <Store className="size-4 text-[#5A3E2B]" />
              Chi nhánh 1 · Trung tâm
              <Check className="ml-auto size-4 text-[#5A3E2B]" />
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="bg-stone-100" />
          <DropdownMenuGroup>
            <DropdownMenuItem disabled className="h-9 rounded-lg px-3 text-xs text-stone-400 whitespace-nowrap">
              Chi nhánh 2 · Sân bay (Đang nâng cấp)
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search Input Bar */}
      <form
        role="search"
        className="ml-auto w-full max-w-md min-w-0 md:ml-4"
        onSubmit={(event) => {
          event.preventDefault()
          const query = new FormData(event.currentTarget).get('q')?.toString().trim() ?? ''
          router.push(query ? `/admin/menu?q=${encodeURIComponent(query)}` : '/admin/menu')
        }}
      >
        <div className="relative flex items-center min-w-0">
          <Search className="absolute left-3.5 size-4 text-stone-400 pointer-events-none" />
          <input
            name="q"
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-stone-200/80 bg-white text-xs md:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#5A3E2B] focus:ring-1 focus:ring-[#5A3E2B]/30 font-sans shadow-2xs transition-colors truncate"
            placeholder="Tìm kiếm nhanh món, đơn, bàn..."
            aria-label="Tìm kiếm món, kho, đơn hàng"
          />
        </div>
      </form>

      {/* Actions: Live Order Button, Notification, Admin Profile */}
      <div className="flex items-center gap-2.5 flex-shrink-0 md:ml-auto">
        <Link
          href="/admin/pos?tab=kitchen"
          className="hidden md:flex h-10 items-center rounded-lg px-3 text-xs font-semibold border border-stone-200/80 bg-white hover:bg-stone-50 gap-2 transition-colors cursor-pointer text-stone-800 shadow-2xs whitespace-nowrap min-w-fit flex-shrink-0"
        >
          <Coffee className="size-4 text-[#5A3E2B]" />
          <span className="whitespace-nowrap">Đơn đang phục vụ</span>
          <Badge className="h-5 min-w-5 text-[11px] font-bold px-1.5 rounded-full bg-[#5A3E2B] text-white tabular-nums whitespace-nowrap">
            {activeCount}
          </Badge>
        </Link>

        {/* Notifications Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="relative h-10 w-10 rounded-lg bg-white border border-stone-200/80 hover:bg-stone-100 flex items-center justify-center text-stone-700 hover:text-stone-900 transition-colors cursor-pointer shadow-2xs flex-shrink-0"
            aria-label={`Thông báo (${notificationCount})`}
          >
            <Bell className="size-4.5" />
            {notificationCount > 0 && (
              <span className="absolute top-2 right-2 size-2 rounded-full bg-red-500 ring-2 ring-white" aria-hidden="true" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-2 rounded-xl bg-white border-stone-200 text-stone-900 shadow-2xl">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-stone-500 px-3 py-2 flex items-center justify-between whitespace-nowrap">
                <span>Thông báo trực tiếp</span>
                <Badge className="bg-[#5A3E2B] text-white text-[10px] whitespace-nowrap">{notificationCount} mới</Badge>
              </DropdownMenuLabel>
              {readyOrders.length === 0 && lowStock.length === 0 && (
                <DropdownMenuItem disabled className="px-3 py-3 text-xs text-stone-400 text-center whitespace-nowrap">
                  Không có thông báo mới nào
                </DropdownMenuItem>
              )}
              {readyOrders.map((order) => (
                <DropdownMenuItem
                  key={order.id}
                  className="h-10 rounded-lg px-3 gap-2.5 hover:bg-stone-100 cursor-pointer text-xs whitespace-nowrap"
                  onClick={() => router.push('/admin/pos?tab=kitchen')}
                >
                  <Coffee className="size-4 text-amber-600 shrink-0" />
                  <span className="truncate font-medium text-stone-800">
                    Món đã pha xong: {order.orderCode} · {order.customer}
                  </span>
                </DropdownMenuItem>
              ))}
              {lowStock.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  className="h-10 rounded-lg px-3 gap-2.5 hover:bg-stone-100 cursor-pointer text-xs whitespace-nowrap"
                  onClick={() => router.push(`/admin/inventory?q=${encodeURIComponent(item.name)}`)}
                >
                  <span className="truncate font-medium text-amber-800">Cảnh báo kho: {item.name}</span>
                  <span className="ml-auto text-xs font-bold text-red-600 tabular-nums whitespace-nowrap">
                    {item.stockQty} {item.unit}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Admin Profile Dropdown: Nguyễn Văn Admin · Quản lý */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-10 items-center gap-2 rounded-lg border border-stone-200/80 bg-white p-1 pr-3 hover:border-stone-300 hover:bg-stone-50 transition-colors cursor-pointer shadow-2xs flex-shrink-0 whitespace-nowrap"
            aria-label="Tài khoản quản trị"
          >
            <Avatar className="size-8 rounded-md border border-[#5A3E2B]/20">
              <AvatarFallback className="font-bold text-xs bg-[#5A3E2B] text-white rounded-md">
                AD
              </AvatarFallback>
            </Avatar>
            <div className="hidden lg:flex flex-col text-left leading-tight whitespace-nowrap">
              <span className="text-xs font-bold text-stone-900 whitespace-nowrap">Nguyễn Văn Admin</span>
              <span className="text-[10px] font-semibold text-amber-900 whitespace-nowrap">Quản lý</span>
            </div>
            <ChevronsUpDown className="size-3 text-stone-400 ml-0.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2 rounded-xl bg-white border-stone-200 text-stone-900 shadow-2xl">
            <DropdownMenuGroup>
              <div className="p-3 bg-[#F7F5F0] rounded-lg border border-stone-200/80 mb-1">
                <p className="text-sm font-bold text-stone-900 whitespace-nowrap">Nguyễn Văn Admin</p>
                <p className="text-xs text-stone-500 whitespace-nowrap">admin@dalatcafe.vn</p>
                <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-amber-900 whitespace-nowrap">
                  <span>Vai trò: Quản trị cấp cao</span>
                  <Badge className="bg-[#5A3E2B] text-white text-[10px] whitespace-nowrap">Toàn quyền</Badge>
                </div>
              </div>
              <DropdownMenuItem
                className="h-10 rounded-lg px-3 gap-2.5 hover:bg-stone-100 cursor-pointer text-xs"
                onClick={() => router.push('/admin/settings')}
              >
                <UserCheck className="size-4 text-stone-500" />
                Cài đặt hồ sơ & Chi nhánh
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-stone-100 my-1" />
            <DropdownMenuItem
              className="h-10 rounded-lg px-3 gap-2.5 hover:bg-rose-50 text-rose-600 cursor-pointer text-xs font-medium"
              onClick={() => {
                toast.success('Đã đăng xuất phiên làm việc an toàn')
                router.push('/')
              }}
            >
              <LogOut className="size-4 text-rose-500" />
              Đăng xuất hệ thống
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
