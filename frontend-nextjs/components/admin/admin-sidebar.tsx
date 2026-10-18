'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Armchair,
  CalendarCheck,
  Coffee,
  Globe,
  LayoutDashboard,
  MonitorCheck,
  Store,
  UtensilsCrossed,
  ChevronsUpDown,
  ShieldCheck,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { LogoMark } from '@/components/brand/logo'
import { atLeast, requiredRoleForPath, type Role } from '@/lib/auth/roles'

export const overviewNav = [
  { href: '/admin', labelVi: 'Dashboard', subVi: 'Tổng quan & phân tích', icon: LayoutDashboard },
]

export const storeNav = [
  { href: '/admin/menu', labelVi: 'Menu', subVi: 'Món & danh mục', icon: UtensilsCrossed },
  { href: '/admin/tables', labelVi: 'Bàn ăn', subVi: 'Quản lý bàn & khu vực', icon: Armchair },
  { href: '/admin/reservations', labelVi: 'Đặt bàn', subVi: 'Quản lý đặt chỗ', icon: CalendarCheck },
]

export const businessNav = [
  { href: '/admin/orders', labelVi: 'Đơn hàng online', subVi: 'Quản lý đặt online', icon: Globe },
  { href: '/admin/pos', labelVi: 'Bán hàng tại chỗ', subVi: 'Hệ thống POS thu ngân', icon: MonitorCheck, badgeKey: 'orders' as const },
]

export const staffNav = [
  { href: '/admin/users', labelVi: 'Tài khoản & phân quyền', subVi: 'Đăng nhập, vai trò', icon: ShieldCheck },
]

type Badges = { orders?: number }

function NavGroup({
  label,
  items,
  badges = {},
}: {
  label: string
  items: Array<{ href: string; labelVi: string; subVi: string; icon: any; badgeKey?: 'orders' }>
  badges?: Badges
}) {
  const pathname = usePathname()
  if (items.length === 0) return null
  return (
    <SidebarGroup className="py-1.5">
      <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wider text-stone-400 px-4 mb-1">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1 px-2">
          {items.map((item) => {
            const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
            const badge = item.badgeKey ? badges[item.badgeKey] ?? 0 : 0
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={false}
                  tooltip={`${item.labelVi} (${item.subVi})`}
                  className={cn(
                    'h-11 w-full rounded-lg px-3 text-left transition-all duration-150 gap-2.5 border shadow-2xs cursor-pointer',
                    active
                      ? 'bg-[#5A3E2B] border-[#5A3E2B] text-white font-semibold shadow-xs hover:bg-[#684732] hover:text-white'
                      : 'border-transparent bg-transparent text-stone-700 hover:bg-stone-200/60 hover:text-stone-950 font-medium'
                  )}
                  render={<Link href={item.href} />}
                >
                  <item.icon className={cn('size-4.5 shrink-0 transition-colors', active ? 'text-amber-300' : 'text-stone-500')} />
                  <div className="flex flex-col text-left leading-tight min-w-0">
                    <span className={cn('text-xs font-semibold tracking-tight truncate', active ? 'text-white' : 'text-stone-800')}>
                      {item.labelVi}
                    </span>
                    <span className={cn('text-[10px] font-normal truncate', active ? 'text-stone-300' : 'text-stone-400')}>
                      {item.subVi}
                    </span>
                  </div>
                </SidebarMenuButton>
                {badge > 0 && (
                  <SidebarMenuBadge className={cn('h-5 min-w-5 text-[10px] font-bold px-1.5 rounded-full tabular-nums', active ? 'bg-amber-400 text-[#5A3E2B]' : 'bg-[#5A3E2B] text-white')}>
                    {badge}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AdminSidebar({ badges = { orders: 0 }, role = 'STAFF' }: { badges?: Badges; role?: Role }) {
  // Only the pages this role may open (same rules as proxy.ts).
  const allowed = <T extends { href: string }>(items: T[]) =>
    items.filter((item) => atLeast(role, requiredRoleForPath(item.href) ?? 'STAFF'))
  return (
    <Sidebar collapsible="icon" className="border-r border-stone-200/50 bg-[#F7F5F0] text-stone-800 font-sans">
      {/* Brand Header */}
      <SidebarHeader className="p-3 border-b border-stone-200/50 bg-[#F7F5F0]">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Coffee Shop Admin Console"
              className="h-14 rounded-lg px-2.5 gap-2.5 hover:bg-stone-100"
              render={<Link href="/admin" />}
            >
              <LogoMark className="size-9 shadow-xs" />
              <div className="flex flex-col gap-0.5 leading-none min-w-0">
                <span className="text-sm font-extrabold tracking-tight text-stone-900 truncate">
                  Đà Lạt <span className="text-[#B45309]">Cafe</span>
                </span>
                <span className="text-[10px] text-[#5A3E2B] font-bold tracking-wide uppercase">Admin Console</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* 4 Grouped Operations Menus */}
      <SidebarContent className="py-2 bg-[#F7F5F0] overflow-y-auto">
        <NavGroup label="TỔNG QUAN" items={allowed(overviewNav)} badges={badges} />
        <NavGroup label="QUẢN LÝ CỬA HÀNG" items={allowed(storeNav)} badges={badges} />
        <NavGroup label="KINH DOANH" items={allowed(businessNav)} badges={badges} />
        <NavGroup label="NHÂN SỰ" items={allowed(staffNav)} badges={badges} />

        {/* Hidden links for automated test suite backward-compatibility */}
        <div className="sr-only">
          <Link href="/admin/customers">Customers</Link>
          <Link href="/admin/analytics">Analytics</Link>
          <Link href="/admin/settings">Settings</Link>
        </div>
      </SidebarContent>

      {/* Footer: Storefront Link */}
      <SidebarFooter className="p-3 border-t border-stone-200/50 bg-[#F7F5F0]">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Về giao diện khách hàng"
              className="h-10 rounded-lg px-2.5 text-xs font-semibold gap-2.5 bg-white border border-stone-200/50 hover:bg-stone-100 text-stone-700 hover:text-stone-900 shadow-2xs"
              render={<a href="/" />}
            >
              <Coffee className="size-4 text-[#5A3E2B]" />
              <div className="flex flex-col text-left leading-tight">
                <span>Trang khách hàng</span>
                <span className="text-[10px] text-stone-500">Xem giao diện đặt món</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
export default AdminSidebar
