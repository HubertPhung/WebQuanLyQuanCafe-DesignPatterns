import type { Metadata, Viewport } from 'next'
import { Lock } from 'lucide-react'
import { AdminHeader } from '@/components/admin/admin-header'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { AdminThemeProvider } from '@/components/admin/shared'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { isAdminAccessAllowed } from '@/lib/admin/access'
import { getHeaderData } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { default: 'Đà Lạt Cafe Admin Console', template: '%s · Đà Lạt Cafe Admin' },
  description: 'Operations console for Đà Lạt Cafe: POS, kitchen display, tables, and inventory.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#F7F5F0',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isAdminAccessAllowed()) {
    return (
      <div data-admin className="flex min-h-svh items-center justify-center bg-[#F7F5F0] p-6 text-stone-900">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Lock />
            </EmptyMedia>
            <EmptyTitle>Yêu cầu đăng nhập nhân viên · Staff sign-in required</EmptyTitle>
            <EmptyDescription className="text-stone-500">
              Đà Lạt Cafe Admin is locked on this deployment until staff authentication is configured.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const header = await getHeaderData()

  return (
    <AdminThemeProvider>
      <TooltipProvider>
        <SidebarProvider data-admin className="bg-[#F7F5F0] text-stone-900 font-sans antialiased">
          <AdminSidebar badges={{ orders: header.activeCount, stock: header.lowStock.length }} />
          <SidebarInset className="min-w-0 relative bg-[#F7F5F0] text-stone-900 overflow-x-hidden">
            {/* Ambient subtle warm coffee glow accents */}
            <div
              className="pointer-events-none absolute -top-40 right-1/4 -z-10 size-96 rounded-full bg-amber-500/5 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute top-1/3 -left-20 -z-10 size-80 rounded-full bg-amber-600/5 blur-3xl"
              aria-hidden="true"
            />
            <AdminHeader {...header} />
            <main className="flex flex-1 flex-col gap-6 md:gap-8 p-4 md:p-6 lg:p-8 w-full max-w-[1560px] mx-auto">{children}</main>
          </SidebarInset>
        </SidebarProvider>
        <Toaster position="bottom-right" richColors />
      </TooltipProvider>
    </AdminThemeProvider>
  )
}
