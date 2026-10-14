'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Award,
  ChevronDown,
  Gift,
  LogOut,
  MapPin,
  Receipt,
  Settings,
  Sparkles,
  User,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'

export interface AccountDropdownProps {
  className?: string
}

export function AccountDropdown({ className }: AccountDropdownProps) {
  const router = useRouter()

  const handleLogout = () => {
    toast.success('Đã đăng xuất tài khoản thành công!')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`group flex items-center gap-2 rounded-full border border-stone-200/90 bg-white/90 p-1.5 pr-2.5 transition-all duration-200 hover:border-amber-400 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-[#3E2723]/20 shadow-xs cursor-pointer ${
          className || ''
        }`}
        aria-label="Tài khoản khách hàng: Phùng Hoài Bo"
      >
        <Avatar className="size-7.5 border border-amber-200/80 bg-amber-50">
          <AvatarImage src="/images/avatar-phung-hoai-bo.png" alt="Phùng Hoài Bo" />
          <AvatarFallback className="bg-[#3E2723] text-amber-100 font-bold text-xs">
            HB
          </AvatarFallback>
        </Avatar>
        <div className="hidden sm:flex flex-col text-left leading-tight">
          <span className="text-xs font-bold text-stone-900 line-clamp-1 group-hover:text-[#3E2723]">
            Phùng Hoài Bo
          </span>
          <span className="text-[10px] font-semibold text-amber-700 flex items-center gap-0.5">
            <Sparkles className="size-2.5 text-amber-500 fill-amber-500" />
            Hạng Vàng
          </span>
        </div>
        <ChevronDown className="size-3.5 text-stone-400 transition-transform duration-200 group-hover:text-stone-700 group-data-[popup-open]:rotate-180" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 rounded-2xl border border-stone-200/80 bg-white p-2 text-stone-900 shadow-xl backdrop-blur-md"
      >
        {/* User Info Card */}
        <DropdownMenuGroup>
          <div className="rounded-xl bg-gradient-to-br from-[#FAF8F5] to-amber-50/60 p-3.5 border border-stone-100">
            <div className="flex items-center gap-3">
              <Avatar className="size-11 border-2 border-white shadow-xs">
                <AvatarFallback className="bg-[#3E2723] text-amber-100 font-bold text-sm">
                  HB
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-stone-900 truncate">
                    Phùng Hoài Bo
                  </h4>
                </div>
                <p className="text-[11px] text-stone-500 truncate font-medium">
                  hoaibo.phung@gmail.com
                </p>
                <p className="text-[11px] text-stone-500 font-medium tabular-nums">
                  0908 123 456
                </p>
              </div>
            </div>

            {/* Loyalty Membership Badge */}
            <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-100/70 px-2.5 py-1.5 border border-amber-200/70">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Award className="size-3.5 text-amber-700" />
                <span>Hạng Vàng</span>
              </div>
              <Badge
                variant="outline"
                className="bg-white/80 text-[10px] font-bold text-amber-800 border-amber-300 tabular-nums px-1.5 py-0"
              >
                350 Điểm
              </Badge>
            </div>
          </div>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1.5 bg-stone-100" />

        {/* Action Navigation Links */}
        <DropdownMenuGroup className="space-y-0.5">
          <DropdownMenuItem
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900 cursor-pointer transition-colors"
            onClick={() => router.push('/account/orders')}
          >
            <Receipt className="size-4 text-stone-500" />
            <span className="flex-1">Lịch sử đơn hàng</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900 cursor-pointer transition-colors"
            onClick={() => router.push('/account/vouchers')}
          >
            <Gift className="size-4 text-amber-600" />
            <span className="flex-1">Voucher của tôi</span>
            <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800 tabular-nums">
              3 mã
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900 cursor-pointer transition-colors"
            onClick={() => router.push('/account/addresses')}
          >
            <MapPin className="size-4 text-stone-500" />
            <span className="flex-1">Sổ địa chỉ</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900 cursor-pointer transition-colors"
            onClick={() => router.push('/account/settings')}
          >
            <Settings className="size-4 text-stone-500" />
            <span className="flex-1">Cài đặt tài khoản</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#3E2723] hover:bg-amber-50 cursor-pointer transition-colors"
            onClick={() => router.push('/admin')}
          >
            <ShieldCheck className="size-4 text-[#3E2723]" />
            <span className="flex-1 font-semibold">Trang Quản trị & POS</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1.5 bg-stone-100" />

        {/* Danger Action: Logout */}
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer transition-colors"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            <span>Đăng xuất</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
export default AccountDropdown

