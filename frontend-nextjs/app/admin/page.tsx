import { DashboardOperationalView } from '@/components/admin/dashboard-operational-view'
import { AutoRefresh } from '@/components/admin/shared'
import { getTables, getActiveOrders, getOverview, getMenuItems, getOrdersSince, getReservations } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tổng quan hoạt động quán cà phê' }

export default async function AdminDashboardPage() {
  const [tables, activeOrders, overview, menuItems, reportOrders, bookings] = await Promise.all([
    getTables(),
    getActiveOrders(),
    getOverview(7),
    getMenuItems(),
    getOrdersSince(6),
    getReservations(),
  ])

  return (
    <>
      <AutoRefresh />

      <DashboardOperationalView
        initialTables={tables}
        initialOrders={activeOrders}
        overview={overview}
        menuItems={menuItems}
        reportOrders={reportOrders}
        reservations={bookings.reservations}
      />
    </>
  )
}
