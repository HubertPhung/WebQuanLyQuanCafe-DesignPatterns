import type { Metadata, Viewport } from 'next'
import { AdminHeader } from '@/components/admin/admin-header'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { requirePageRole } from '@/lib/auth/session'
import { getHeaderData } from '@/lib/admin/queries'
import { getAdminBranch } from '@/lib/admin/branch'

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
  // proxy.ts already redirected visitors; this is the authoritative check for every admin page.
  const session = await requirePageRole('STAFF', '/admin')
  const [header, branch] = await Promise.all([getHeaderData(), getAdminBranch()])

  return (
      <TooltipProvider>
        <SidebarProvider data-admin className="bg-[#F7F5F0] text-stone-900 font-sans antialiased">
          <AdminSidebar role={session.role} badges={{ orders: header.activeCount, reservations: header.pendingReservations.length }} />
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
            <AdminHeader {...header} branch={branch} user={{ name: session.name, email: session.email, role: session.role }} />
            <main className="flex flex-1 flex-col gap-6 md:gap-8 p-4 md:p-6 lg:p-8 w-full max-w-[1560px] mx-auto">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
  )
}
