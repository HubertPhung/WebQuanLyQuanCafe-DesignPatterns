import type { FloorTable, Order } from '@/lib/db/schema'

export function tableHasOpenOrder(tableId: number, orders: Pick<Order, 'tableId' | 'tableIds' | 'status' | 'paymentStatus'>[]): boolean {
  return orders.some(order => (order.tableIds?.length ? order.tableIds : order.tableId ? [order.tableId] : []).includes(tableId)
    && order.status !== 'cancelled' && (order.status !== 'completed' || order.paymentStatus === 'unpaid'))
}

export function markTablesInUse(tables: FloorTable[], orders: Order[]): FloorTable[] {
  return tables.map(table => tableHasOpenOrder(table.id, orders)
    ? { ...table, status: 'occupied', guestCount: Math.max(1, table.guestCount) }
    : table)
}
