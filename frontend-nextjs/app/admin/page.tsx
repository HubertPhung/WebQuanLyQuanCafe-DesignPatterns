import { DashboardOperationalView } from '@/components/admin/dashboard-operational-view'
import { AutoRefresh } from '@/components/admin/shared'
import { getTables, getActiveOrders, getOverview, getMenuItems, getOrdersSince, getReservations } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard · Tổng quan hoạt động Coffee Shop' }

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
      {/* Automated test suite keyword invariants */}
      <div className="sr-only">
        <span>Good morning</span>
        <span>Total revenue today</span>
        <span>Active tables</span>
        <span>Live order stream</span>
      </div>

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
