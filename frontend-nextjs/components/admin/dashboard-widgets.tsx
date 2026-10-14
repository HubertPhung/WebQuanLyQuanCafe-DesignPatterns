'use client'

import { useState, useTransition } from 'react'
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { updateOrderStatus } from '@/app/admin/actions'
import { formatCurrency, formatTime, paymentLabels, statusLabels } from '@/lib/admin/format'
import { orderStatuses, type Order, type OrderStatus } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import { OrderFulfillmentBar } from './fulfillment-progress'
import { OrderStatusBadge } from './shared'

export { MetricCard } from './metric-card'

function StatusSelect({ order }: { order: Order }) {
  const [pending, startTransition] = useTransition()
  return (
    <Select
      value={order.status}
      disabled={pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const result = await updateOrderStatus(order.id, value as OrderStatus)
          if (!result.ok) toast.error(result.error)
          else toast.success(`${order.orderCode} đã chuyển sang ${statusLabels[value as OrderStatus].toLowerCase()}`)
        })
      }
    >
      <SelectTrigger size="sm" aria-label={`Trạng thái cho ${order.orderCode}`} className="w-32">
        <SelectValue>{(value: OrderStatus) => statusLabels[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {orderStatuses.map((status) => (
            <SelectItem key={status} value={status}>
              {statusLabels[status]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function OrderStream({ orders }: { orders: Order[] }) {
  const [filter, setFilter] = useState<string>('all')

  const filteredOrders = orders.filter((order) => {
    if (filter === 'in-progress') return order.status !== 'completed'
    if (filter === 'completed') return order.status === 'completed'
    if (filter === 'unpaid') return order.paymentStatus !== 'paid'
    return true
  })

  return (
    <div className="rounded-xl border border-stone-200/90 bg-white p-6 md:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 hover:border-stone-300 hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-stone-100">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
            <span>Dòng đơn hàng trực tiếp</span>
            <span className="sr-only">Live order stream</span>
          </h2>
          <p className="text-sm md:text-base text-stone-600 font-medium mt-1">Hàng đợi thời gian thực trên toàn bộ hệ thống quầy và đặt bàn. Tự động làm mới.</p>
        </div>
        <ToggleGroup
          value={[filter]}
          onValueChange={(val) => val[0] && setFilter(val[0])}
          variant="outline"
          size="sm"
          aria-label="Lọc đơn hàng"
          className="self-start sm:self-auto gap-1"
        >
          <ToggleGroupItem value="all" className="text-xs md:text-sm font-semibold h-9 px-3.5 rounded-lg">
            Tất cả ({orders.length})
          </ToggleGroupItem>
          <ToggleGroupItem value="in-progress" className="text-xs md:text-sm font-semibold h-9 px-3.5 rounded-lg">
            Đang phục vụ ({orders.filter((o) => o.status !== 'completed').length})
          </ToggleGroupItem>
          <ToggleGroupItem value="completed" className="text-xs md:text-sm font-semibold h-9 px-3.5 rounded-lg">
            Hoàn tất ({orders.filter((o) => o.status === 'completed').length})
          </ToggleGroupItem>
          <ToggleGroupItem value="unpaid" className="text-xs md:text-sm font-semibold h-9 px-3.5 rounded-lg">
            Chưa trả ({orders.filter((o) => o.paymentStatus !== 'paid').length})
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="pt-4 overflow-x-auto">
        {filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-sm font-medium text-stone-500">
            Không có đơn hàng nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-stone-50/60">
              <TableRow className="border-b border-stone-200/90">
                <TableHead className="text-xs font-semibold uppercase tracking-wider py-3 px-3 text-stone-500">Mã đơn</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider py-3 px-3 text-stone-500">Khách hàng</TableHead>
                <TableHead className="hidden md:table-cell text-xs font-semibold uppercase tracking-wider py-3 px-3 text-stone-500">Món gọi</TableHead>
                <TableHead className="hidden sm:table-cell text-xs font-semibold uppercase tracking-wider py-3 px-3 text-stone-500">Thanh toán</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wider py-3 px-3 text-stone-500">Tổng tiền</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider py-3 px-3 text-stone-500">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const initials = (order.customer || 'K')
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()

                return (
                  <TableRow key={order.id} className="hover:bg-stone-50/80 transition-colors border-b border-stone-100">
                    <TableCell className="py-3 px-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-stone-900 text-sm tracking-tight">{order.orderCode}</span>
                        <span className="text-xs text-stone-500 font-medium">
                          {formatTime(order.createdAt)} · {order.tableId ? `Bàn ${order.tableId}` : order.orderType === 'dine-in' ? 'Tại quán' : 'Mang về'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 text-xs font-bold bg-stone-100 text-stone-900">
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-stone-900 text-sm">{order.customer || 'Khách vãng lai'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-56 md:table-cell py-3 px-3">
                      <span className="block truncate text-sm text-stone-600 font-normal">
                        {order.items.map((item) => `${item.qty}× ${item.name}`).join(', ')}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell py-3 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-xs font-medium text-stone-900">{paymentLabels[order.paymentMethod]}</span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-bold leading-none',
                            order.paymentStatus === 'paid'
                              ? 'border-emerald-300/80 bg-emerald-50/90 text-emerald-900'
                              : 'border-amber-300/80 bg-amber-50/90 text-amber-950'
                          )}
                        >
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              order.paymentStatus === 'paid' ? 'bg-emerald-600' : 'bg-amber-600'
                            )}
                          />
                          {order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-stone-900 text-sm md:text-base py-3 px-3">
                      {formatCurrency(order.total)}
                    </TableCell>
                    <TableCell className="min-w-36 py-3.5">
                      <div className="flex flex-col gap-1.5 items-start">
                        {order.status === 'completed' ? (
                          <OrderStatusBadge status="completed" />
                        ) : (
                          <StatusSelect order={order} />
                        )}
                        <OrderFulfillmentBar status={order.status} size="xs" className="max-w-[130px]" />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
