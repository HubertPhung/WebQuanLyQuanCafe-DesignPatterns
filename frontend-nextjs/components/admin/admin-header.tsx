'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CalendarClock, Check, ChevronsUpDown, Coffee, LogOut, RefreshCw, Store, UserCheck } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
import { signOut } from '@/app/auth/actions'
import { selectAdminBranch } from '@/app/admin/actions'
import { branches, branchById, type BranchId } from '@/lib/branches'
import { roleLabels, type Role } from '@/lib/auth/roles'

type HeaderProps = {
  readyOrders?: { id: number; orderCode: string; customer: string }[]
  pendingReservations?: { id: string; customer: string; dateTime: string; guests: number }[]
  pendingSync?: number
  activeCount?: number
  branch: BranchId
  user: { name: string; email: string; role: Role }
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(-2)
    .join('')
    .toUpperCase() || 'NV'
}

export function AdminHeader({
  readyOrders = [],
  pendingReservations = [],
  pendingSync = 0,
  activeCount = 0,
  branch,
  user,
}: HeaderProps) {
  const router = useRouter()
  // Hiện ngay lập tức; server render lại mọi trang admin cho chi nhánh mới.
  const [shownBranch, setShownBranch] = useState(branch)
  const [switching, startSwitch] = useTransition()
  const chooseBranch = (next: BranchId) => {
    if (next === shownBranch) return
    const previous = shownBranch
    setShownBranch(next)
    startSwitch(async () => {
      const result = await selectAdminBranch(next)
      if (!result.ok) {
        setShownBranch(previous)
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      router.refresh()
    })
  }
  const notificationCount = readyOrders.length + pendingReservations.length + (pendingSync > 0 ? 1 : 0)

  return (
    <header className="sticky top-0 z-20 flex h-20 shrink-0 items-center gap-3 border-b border-stone-200/50 bg-[#F7F5F0]/90 backdrop-blur-md px-4 md:px-8 text-stone-900 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <SidebarTrigger className="h-10 w-10 rounded-lg bg-white border border-stone-200/50 hover:bg-stone-100 text-stone-700 hover:text-stone-900 shadow-2xs flex-shrink-0 flex items-center justify-center" />
      <Separator orientation="vertical" className="h-5 bg-stone-200 flex-shrink-0" />

      {/* Chọn chi nhánh */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="hidden sm:flex h-10 rounded-lg px-3.5 text-xs md:text-sm font-semibold border border-stone-200/80 bg-white hover:bg-stone-50 gap-2 items-center cursor-pointer transition-colors shadow-2xs whitespace-nowrap min-w-fit flex-shrink-0"
        >
          <Store className={`size-4 text-[#5A3E2B] ${switching ? 'animate-pulse' : ''}`} />
          <span className="font-semibold tracking-tight text-stone-800 whitespace-nowrap">{branchById(shownBranch).street}</span>
          <ChevronsUpDown className="size-3.5 text-stone-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 p-1.5 rounded-xl bg-white border-stone-200 text-stone-900 shadow-xl">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-stone-500 px-3 py-2 whitespace-nowrap">
              Chi nhánh cửa hàng
            </DropdownMenuLabel>
            {branches.map((option) => (
              <DropdownMenuItem
                key={option.id}
                disabled={switching}
                onClick={() => chooseBranch(option.id)}
                className="h-10 rounded-lg px-3 text-sm font-medium hover:bg-stone-100 text-stone-900 cursor-pointer whitespace-nowrap"
              >
                <Store className="size-4 text-[#5A3E2B]" />
                {option.street}
                {shownBranch === option.id && <Check className="ml-auto size-4 text-[#5A3E2B]" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Các thao tác: nút đơn đang phục vụ, thông báo, hồ sơ admin */}
      <div className="ml-auto flex items-center gap-2.5 flex-shrink-0">
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

        {/* Danh sách thông báo */}
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
              {notificationCount === 0 && (
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
              {pendingReservations.map((reservation) => (
                <DropdownMenuItem
                  key={reservation.id}
                  className="h-10 rounded-lg px-3 gap-2.5 hover:bg-stone-100 cursor-pointer text-xs whitespace-nowrap"
                  onClick={() => router.push('/admin/reservations')}
                >
                  <CalendarClock className="size-4 text-sky-600 shrink-0" />
                  <span className="truncate font-medium text-stone-800">
                    Đặt bàn chờ xác nhận: {reservation.customer} · {reservation.guests} khách · {reservation.dateTime}
                  </span>
                </DropdownMenuItem>
              ))}
              {pendingSync > 0 && (
                <DropdownMenuItem
                  className="h-10 rounded-lg px-3 gap-2.5 hover:bg-stone-100 cursor-pointer text-xs whitespace-nowrap"
                  onClick={() => router.push('/admin/pos')}
                >
                  <RefreshCw className="size-4 text-rose-600 shrink-0" />
                  <span className="truncate font-medium text-stone-800">{pendingSync} đơn offline chờ đồng bộ sang Java</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tài khoản đang đăng nhập */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-10 items-center gap-2 rounded-lg border border-stone-200/80 bg-white p-1 pr-3 hover:border-stone-300 hover:bg-stone-50 transition-colors cursor-pointer shadow-2xs flex-shrink-0 whitespace-nowrap"
            aria-label="Tài khoản quản trị"
          >
            <Avatar className="size-8 rounded-md border border-[#5A3E2B]/20">
              <AvatarFallback className="font-bold text-xs bg-[#5A3E2B] text-white rounded-md">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden lg:flex flex-col text-left leading-tight whitespace-nowrap">
              <span className="text-xs font-bold text-stone-900 whitespace-nowrap">{user.name}</span>
              <span className="text-[10px] font-semibold text-amber-900 whitespace-nowrap">{roleLabels[user.role]}</span>
            </div>
            <ChevronsUpDown className="size-3 text-stone-400 ml-0.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2 rounded-xl bg-white border-stone-200 text-stone-900 shadow-2xl">
            <DropdownMenuGroup>
              <div className="p-3 bg-[#F7F5F0] rounded-lg border border-stone-200/80 mb-1">
                <p className="text-sm font-bold text-stone-900 whitespace-nowrap">{user.name}</p>
                <p className="text-xs text-stone-500 whitespace-nowrap">{user.email}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-amber-900 whitespace-nowrap">
                  <span>Vai trò: {roleLabels[user.role]}</span>
                  {user.role === 'ADMIN' && <Badge className="bg-[#5A3E2B] text-white text-[10px] whitespace-nowrap">Toàn quyền</Badge>}
                </div>
              </div>
              <DropdownMenuItem
                className="h-10 rounded-lg px-3 gap-2.5 hover:bg-stone-100 cursor-pointer text-xs"
                onClick={() => router.push('/account/security')}
              >
                <UserCheck className="size-4 text-stone-500" />
                Mật khẩu & bảo mật
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-stone-100 my-1" />
            <DropdownMenuItem
              className="h-10 rounded-lg px-3 gap-2.5 hover:bg-rose-50 text-rose-600 cursor-pointer text-xs font-medium"
              onClick={() => {
                toast.success('Đã đăng xuất')
                void signOut()
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
