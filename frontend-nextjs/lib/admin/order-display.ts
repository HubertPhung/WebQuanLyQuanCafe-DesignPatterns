import type { FloorTable, Order } from '@/lib/db/schema'

export function formatOrderTables(order: Pick<Order, 'tableId' | 'tableIds' | 'orderType'>, tables: Pick<FloorTable, 'id' | 'name'>[] = []) {
  const ids = [...new Set([...(order.tableIds ?? []), ...(order.tableId == null ? [] : [order.tableId])])]
  if (!ids.length) return order.orderType === 'dine-in' ? 'Tại quán' : order.orderType === 'pickup' ? 'Mang về' : 'Giao hàng'
  return ids.map(id => tables.find(table => table.id === id)?.name.replace(/^Table\s*/i, 'Bàn ') ?? `Bàn ${id}`).join(', ')
}
