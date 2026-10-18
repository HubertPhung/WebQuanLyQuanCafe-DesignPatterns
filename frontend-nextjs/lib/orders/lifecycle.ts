import type { Order, OrderStatus } from '@/lib/db/schema'

export function orderTransitionError(order: Pick<Order, 'status' | 'paymentStatus'>, target: OrderStatus): string | null {
  if (order.status === target) return null
  if (order.status === 'completed' || order.status === 'cancelled') return 'Đơn đã kết thúc, không thể đổi trạng thái.'
  const flow: OrderStatus[] = ['pending', 'brewing', 'ready', 'completed']
  if (target !== 'cancelled' && flow.indexOf(target) < flow.indexOf(order.status)) return 'Không thể chuyển đơn về bước trước.'
  if (target === 'completed' && order.paymentStatus !== 'paid') return 'Cần thu tiền trước khi giao món.'
  return null
}
