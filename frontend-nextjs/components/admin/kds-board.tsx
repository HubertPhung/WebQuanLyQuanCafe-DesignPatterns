'use client'

import { useEffect, useState, useTransition } from 'react'
import { AlertCircle, CheckCircle2, Clock, Coffee, Filter, Utensils } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { markOrderPaid, updateOrderStatus } from '@/app/admin/actions'
import { formatCurrency, formatElapsed } from '@/lib/admin/format'
import type { Order, OrderStatus, OrderType } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { OrderFulfillmentBar } from './fulfillment-progress'

const columns: {
  status: Exclude<OrderStatus, 'completed'>
  title: string
  sublabel: string
  next: OrderStatus
  action: string
  headerBg: string
  badgeVariant: 'default' | 'secondary' | 'outline'
}[] = [
  {
    status: 'pending',
    title: 'Chờ pha chế',
    sublabel: 'Pending',
    next: 'brewing',
    action: 'Bắt đầu pha',
    headerBg: 'bg-amber-500/10 border-amber-500/20 text-amber-700',
    badgeVariant: 'secondary',
  },
  {
    status: 'brewing',
    title: 'Đang thực hiện',
    sublabel: 'Brewing',
    next: 'ready',
    action: 'Báo hoàn thành',
    headerBg: 'bg-blue-500/10 border-blue-500/20 text-blue-700',
    badgeVariant: 'secondary',
  },
  {
    status: 'ready',
    title: 'Sẵn sàng phục vụ',
    sublabel: 'Ready',
    next: 'completed',
    action: 'Giao món',
    headerBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700',
    badgeVariant: 'secondary',
  },
]

function TicketCard({ order, now, next, action }: { order: Order; now: number; next: OrderStatus; action: string }) {
  const [pending, startTransition] = useTransition()
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({})
  const minutes = (now - new Date(order.createdAt).getTime()) / 60000
  const late = minutes > 10

  function toggleItem(index: number) {
    setCheckedItems((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await task()
      if (!result.ok) toast.error(result.error ?? 'Cập nhật thất bại')
    })
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
    >
      <Card
        size="sm"
        className={cn(
          'transition-all duration-300 shadow-sm hover:-translate-y-0.5 hover:shadow-md bg-white',
          late
            ? 'border-amber-500/80 bg-amber-50/30 ring-1 ring-amber-500/40'
            : 'border-stone-200/80 hover:border-stone-400'
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold tracking-tight text-stone-900">{order.orderCode}</CardTitle>
              <CardDescription className="text-xs">
                <span className="font-semibold text-stone-800">{order.customer || 'Khách vãng lai'}</span>
                {' · '}
                <span className="font-medium text-stone-600">
                  {order.tableId ? `Bàn ${order.tableId}` : order.orderType === 'dine-in' ? 'Tại quán' : order.orderType === 'pickup' ? 'Mang về' : 'Giao hàng'}
                </span>
              </CardDescription>
            </div>
            <Badge
              variant={late ? 'destructive' : 'secondary'}
              className={cn('text-xs font-semibold tabular-nums', late ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse' : 'bg-stone-100 text-stone-700')}
            >
              {late ? <AlertCircle data-icon="inline-start" className="size-3" /> : <Clock data-icon="inline-start" className="size-3" />}
              {formatElapsed(order.createdAt, now)}
            </Badge>
          </div>
        </CardHeader>
        <div className="px-3 pb-1">
          <OrderFulfillmentBar status={order.status} showSteps size="xs" />
        </div>
        <CardContent className="py-2">
          <ul className="flex flex-col gap-1.5 text-xs">
            {order.items.map((item, index) => {
              const isChecked = !!checkedItems[index]
              return (
                <li
                  key={`${item.name}-${index}`}
                  onClick={() => toggleItem(index)}
                  className={cn(
                    'flex items-center gap-2 rounded-md p-1.5 cursor-pointer transition-colors',
                    isChecked
                      ? 'bg-stone-100 text-stone-400 line-through'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-900'
                  )}
                  role="button"
                  tabIndex={0}
                  aria-label={`Đánh dấu món ${item.name}`}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      toggleItem(index)
                    }
                  }}
                >
                  <div
                    className={cn(
                      'size-4 rounded border flex items-center justify-center shrink-0 text-[10px]',
                      isChecked
                        ? 'bg-[#5A3E2B] border-[#5A3E2B] text-white'
                        : 'border-stone-300 bg-white'
                    )}
                  >
                    {isChecked ? '✓' : ''}
                  </div>
                  <span className="font-bold tabular-nums text-sm text-stone-900">{item.qty}×</span>
                  <span className="flex-1 font-medium leading-tight">
                    {item.name}
                    {item.variation && (
                      <span className="ml-1 text-[11px] font-normal text-stone-500">({item.variation})</span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs">
          <div className="flex items-center gap-2">
            {order.paymentStatus === 'paid' ? (
              <Badge variant="outline" className="border-emerald-300/80 bg-emerald-50/90 text-emerald-900 font-bold text-[10px]">
                Đã thanh toán · {formatCurrency(order.total)}
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2 border-amber-300 bg-amber-50/90 text-amber-950 hover:bg-amber-100 font-bold"
                disabled={pending}
                onClick={() => run(() => markOrderPaid(order.id))}
              >
                Thu {formatCurrency(order.total)}
              </Button>
            )}
          </div>
          <Button
            size="sm"
            className="h-7 text-xs px-3 font-bold ml-auto bg-[#5A3E2B] hover:bg-[#684732] text-white"
            disabled={pending}
            onClick={() => run(() => updateOrderStatus(order.id, next))}
          >
            {action}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

export function KdsBoard({ orders }: { orders: Order[] }) {
  const [filterType, setFilterType] = useState<string>('all')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(id)
  }, [])

  const filteredOrders = filterType === 'all'
    ? orders
    : orders.filter((o) => o.orderType === filterType)

  const activeCount = orders.filter((o) => o.status !== 'completed').length

  return (
    <div className="flex flex-col gap-6">
      {/* Top Filter and Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200/90 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-stone-500" />
          <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">Kênh bán:</span>
          <ToggleGroup
            value={[filterType]}
            onValueChange={(val) => val[0] && setFilterType(val[0])}
            variant="outline"
            size="sm"
            aria-label="Lọc đơn hàng theo kênh"
            className="gap-1"
          >
            <ToggleGroupItem value="all" className="h-9 px-3 text-xs md:text-sm font-semibold rounded-lg">
              Tất cả kênh ({orders.length})
            </ToggleGroupItem>
            <ToggleGroupItem value="dine-in" className="h-9 px-3 text-xs md:text-sm font-semibold rounded-lg">
              Tại quán ({orders.filter((o) => o.orderType === 'dine-in').length})
            </ToggleGroupItem>
            <ToggleGroupItem value="pickup" className="h-9 px-3 text-xs md:text-sm font-semibold rounded-lg">
              Mang về ({orders.filter((o) => o.orderType === 'pickup').length})
            </ToggleGroupItem>
            <ToggleGroupItem value="delivery" className="h-9 px-3 text-xs md:text-sm font-semibold rounded-lg">
              Giao hàng ({orders.filter((o) => o.orderType === 'delivery').length})
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex items-center gap-3 text-xs text-stone-500">
          <span className="flex items-center gap-1.5 font-semibold text-stone-700">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Điều phối quầy pha chế <span className="sr-only">Live Kitchen Display Kitchen display</span>
          </span>
          <span className="font-bold text-stone-900 tabular-nums bg-stone-100/90 px-2.5 py-1 rounded-md">
            {activeCount} đơn đang xử lý
          </span>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid gap-6 lg:grid-cols-3">
        {columns.map((column) => {
          const tickets = filteredOrders.filter((order) => order.status === column.status)
          return (
            <section
              key={column.status}
              aria-labelledby={`kds-${column.status}`}
              className="flex flex-col gap-3 rounded-xl border border-stone-200/90 bg-[#F9F7F4] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h2 id={`kds-${column.status}`} className="font-bold text-base tracking-tight text-stone-900">
                    {column.title}
                  </h2>
                  <span className="sr-only">
                    ({column.sublabel})
                  </span>
                </div>
                <Badge variant="outline" className="font-bold tabular-nums text-xs bg-white text-stone-800 border-stone-200 rounded-full px-2.5 py-0.5">
                  {tickets.length}
                </Badge>
              </div>

              <div className="flex flex-col gap-3 min-h-[300px]">
                {tickets.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 p-8 text-center text-xs text-stone-500 bg-white/50">
                    <Coffee className="size-8 stroke-[1.5] text-stone-400 mb-2" />
                    <span>Không có đơn trong danh mục {column.title.toLowerCase()}</span>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {tickets.map((order) => (
                      <TicketCard
                        key={order.id}
                        order={order}
                        now={now}
                        next={column.next}
                        action={column.action}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
