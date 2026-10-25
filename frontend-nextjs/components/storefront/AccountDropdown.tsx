'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, Gift, KeyRound, LogIn, LogOut, MapPin, Receipt, Settings, ShieldCheck } from 'lucide-react'
import { signOut } from '@/app/auth/actions'
import { atLeast, roleLabels, type Role } from '@/lib/auth/roles'

export type StorefrontAccount = { name: string; email: string; role: Role }

export interface AccountDropdownProps {
  className?: string
  account?: StorefrontAccount | null
}

function initials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(-2)
      .join('')
      .toUpperCase() || 'KH'
  )
}

const itemClass =
  'flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900 cursor-pointer transition-colors'

// Khách hàng hoặc nhân viên đã đăng nhập (lấy từ cookie phiên); nếu không thì hiện link đăng nhập.
export function AccountDropdown({ className, account }: AccountDropdownProps) {
  const router = useRouter()

  if (!account) {
    return (
      <Link
        href="/login"
        className={`flex h-11 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-xs font-bold text-stone-800 shadow-xs transition-colors hover:border-[#3E2723] hover:bg-stone-50 ${className ?? ''}`}
      >
        <LogIn className="size-4 text-[#3E2723]" />
        <span className="hidden sm:inline">Đăng nhập</span>
        <span className="sr-only sm:hidden">Đăng nhập</span>
      </Link>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`group flex items-center gap-2 rounded-full border border-stone-200/90 bg-white/90 p-1.5 pr-2.5 transition-all duration-200 hover:border-amber-400 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-[#3E2723]/20 shadow-xs cursor-pointer ${
          className || ''
        }`}
        aria-label={`Tài khoản: ${account.name}`}
      >
        <Avatar className="size-7.5 border border-amber-200/80 bg-amber-50">
          <AvatarFallback className="bg-[#3E2723] text-amber-100 font-bold text-xs">{initials(account.name)}</AvatarFallback>
        </Avatar>
        <div className="hidden sm:flex flex-col text-left leading-tight">
          <span className="text-xs font-bold text-stone-900 line-clamp-1 group-hover:text-[#3E2723]">{account.name}</span>
          <span className="text-[10px] font-semibold text-amber-700">{roleLabels[account.role]}</span>
        </div>
        <ChevronDown className="size-3.5 text-stone-400 transition-transform duration-200 group-hover:text-stone-700 group-data-[popup-open]:rotate-180" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 rounded-2xl border border-stone-200/80 bg-white p-2 text-stone-900 shadow-xl backdrop-blur-md"
      >
        <DropdownMenuGroup>
          <div className="rounded-xl bg-gradient-to-br from-[#FAF8F5] to-amber-50/60 p-3.5 border border-stone-100">
            <div className="flex items-center gap-3">
              <Avatar className="size-11 border-2 border-white shadow-xs">
                <AvatarFallback className="bg-[#3E2723] text-amber-100 font-bold text-sm">{initials(account.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-stone-900 truncate">{account.name}</h4>
                <p className="text-[11px] text-stone-500 truncate font-medium">{account.email}</p>
              </div>
              <Badge variant="outline" className="bg-white/80 text-[10px] font-bold text-amber-800 border-amber-300 px-1.5 py-0">
                {roleLabels[account.role]}
              </Badge>
            </div>
          </div>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1.5 bg-stone-100" />

        <DropdownMenuGroup className="space-y-0.5">
          <DropdownMenuItem className={itemClass} onClick={() => router.push('/account/orders')}>
            <Receipt className="size-4 text-stone-500" />
            <span className="flex-1">Lịch sử đơn hàng</span>
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClass} onClick={() => router.push('/account/vouchers')}>
            <Gift className="size-4 text-amber-600" />
            <span className="flex-1">Voucher của tôi</span>
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClass} onClick={() => router.push('/account/addresses')}>
            <MapPin className="size-4 text-stone-500" />
            <span className="flex-1">Sổ địa chỉ</span>
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClass} onClick={() => router.push('/account/settings')}>
            <Settings className="size-4 text-stone-500" />
            <span className="flex-1">Cài đặt tài khoản</span>
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClass} onClick={() => router.push('/account/security')}>
            <KeyRound className="size-4 text-stone-500" />
            <span className="flex-1">Mật khẩu & bảo mật</span>
          </DropdownMenuItem>
          {atLeast(account.role, 'STAFF') && (
            <DropdownMenuItem
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#3E2723] hover:bg-amber-50 cursor-pointer transition-colors"
              onClick={() => router.push('/admin')}
            >
              <ShieldCheck className="size-4 text-[#3E2723]" />
              <span className="flex-1 font-semibold">Trang Quản trị & POS</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1.5 bg-stone-100" />

        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer transition-colors"
            onClick={() => void signOut()}
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
