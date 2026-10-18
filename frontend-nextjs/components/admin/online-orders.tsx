'use client'

import { useState, useTransition } from 'react'
import { Banknote, Eye, Globe, Package, Search, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { markOrderPaid, updateOrderStatus } from '@/app/admin/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { OnlineOrderView } from '@/lib/admin/queries'
import type { OrderStatus } from '@/lib/db/schema'
import { cn } from '@/lib/utils'

// Storefront orders as the kitchen and Java see them. Each step goes through the same server
// actions as the KDS board; Java only completes an order that is paid, so cash on delivery is
// marked paid first.

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = { pending: 'brewing', brewing: 'ready', ready: 'completed' }

function statusLabel(order: OnlineOrderView) {
  if (order.status === 'pending') return 'Chờ pha chế'
  if (order.status === 'brewing') return 'Đang pha chế'
  if (order.status === 'ready') return order.contact.fulfilment === 'delivery' ? 'Đang giao' : 'Chờ khách lấy'
  return 'Hoàn thành'
}

function nextStepLabel(order: OnlineOrderView) {
  if (order.status === 'pending') return 'Bắt đầu pha chế'
  if (order.status === 'brewing') return order.contact.fulfilment === 'delivery' ? 'Bàn giao shipper' : 'Báo khách đến lấy'
  if (order.status === 'ready') return order.contact.fulfilment === 'delivery' ? 'Đã giao xong' : 'Khách đã nhận'
  return null
}

const statusStyles: Record<OrderStatus, string> = {
  pending: 'bg-amber-50/90 text-amber-950 border-amber-300/80',
  brewing: 'bg-purple-50/90 text-purple-950 border-purple-300/80',
  ready: 'bg-blue-50/90 text-blue-950 border-blue-300/80',
  completed: 'bg-emerald-50/90 text-emerald-900 border-emerald-300/80',
}

const filters: { id: 'all' | OrderStatus; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ pha chế' },
  { id: 'brewing', label: 'Đang pha chế' },
  { id: 'ready', label: 'Đang giao / chờ lấy' },
  { id: 'completed', label: 'Hoàn thành' },
]

const paymentLabels: Record<string, string> = { qr: 'VietQR', card: 'Thẻ', cash: 'Tiền mặt khi nhận' }

const time = (value: Date | string) =>
  new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })

export function OnlineOrders({ orders }: { orders: OnlineOrderView[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const selected = orders.find((order) => order.orderCode === selectedCode) ?? null
  const query = search.trim().toLowerCase()
  const filtered = orders.filter(
    (order) =>
      (statusFilter === 'all' || order.status === statusFilter) &&
      (!query ||
        order.orderCode.toLowerCase().includes(query) ||
        order.customer.toLowerCase().includes(query) ||
        order.contact.phone.includes(query.replace(/\D/g, '') || query)),
  )

  function advance(order: OnlineOrderView) {
    const next = nextStatus[order.status]
    if (!next) return
    startTransition(async () => {
      const result = await updateOrderStatus(order.id, next)
      if (result.ok) toast.success(`Đơn ${order.orderCode}: ${nextStepLabel(order)}`)
      else toast.error(result.error)
    })
  }

  function collectCash(order: OnlineOrderView) {
    startTransition(async () => {
      const result = await markOrderPaid(order.id)
      if (result.ok) toast.success(`Đã thu tiền đơn ${order.orderCode}`)
      else toast.error(result.error)
    })
  }

  return (
    <div className="space-y-6 font-sans text-stone-900">
      <div className="space-y-4 rounded-xl border border-stone-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-3 size-4 text-stone-400" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã ĐH, khách hàng, SĐT..."
              aria-label="Tìm đơn online"
              className="h-10 w-full truncate rounded-lg border border-stone-200/90 bg-white pl-10 pr-4 text-xs text-stone-900 placeholder:text-stone-400 focus:border-[#5A3E2B] focus:outline-none md:text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={statusFilter === tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  'cursor-pointer rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors',
                  statusFilter === tab.id
                    ? 'border-[#5A3E2B] bg-[#5A3E2B] text-white shadow-xs'
                    : 'border-stone-200/90 bg-stone-100/90 text-stone-700 hover:bg-stone-200/60 hover:text-stone-950',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-stone-200/90 bg-white">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-stone-200/90 bg-stone-50/60 text-xs font-semibold uppercase tracking-wider text-stone-500">
                <th className="px-3 py-3">Mã ĐH</th>
                <th className="px-3 py-3">Khách hàng</th>
                <th className="px-3 py-3">Loại đơn</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3 text-right">Tổng tiền</th>
                <th className="px-3 py-3">Thời gian đặt</th>
                <th className="px-3 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((order) => (
                <tr key={order.orderCode} className="transition-colors hover:bg-stone-50/60">
                  <td className="px-3 py-3.5 font-mono font-bold text-[#5A3E2B]">{order.orderCode}</td>
                  <td className="px-3 py-3.5">
                    <strong className="block font-bold text-stone-900">{order.customer}</strong>
                    <span className="font-mono text-[11px] text-stone-500">{order.contact.phone}</span>
                  </td>
                  <td className="px-3 py-3.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                        order.contact.fulfilment === 'delivery' ? 'border-blue-200 bg-blue-50/90 text-blue-900' : 'border-stone-200 bg-stone-100/90 text-stone-800',
                      )}
                    >
                      {order.contact.fulfilment === 'delivery' ? <Truck className="size-3" aria-hidden="true" /> : <Package className="size-3" aria-hidden="true" />}
                      {order.contact.fulfilment === 'delivery' ? 'Giao hàng' : 'Tự lấy'}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold', statusStyles[order.status])}>
                      {statusLabel(order)}
                    </span>
                    {order.paymentStatus !== 'paid' && <span className="ml-1.5 text-[11px] font-semibold text-amber-800">· chưa thu tiền</span>}
                  </td>
                  <td className="px-3 py-3.5 text-right text-sm font-black tabular-nums text-[#5A3E2B]">{order.total.toLocaleString('vi-VN')} đ</td>
                  <td className="px-3 py-3.5 font-mono text-xs text-stone-500">{time(order.createdAt)}</td>
                  <td className="px-3 py-3.5 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedCode(order.orderCode)}
                      className="h-8 gap-1.5 rounded-md border-stone-200 bg-white px-2.5 text-xs text-stone-700 shadow-2xs hover:bg-stone-50"
                    >
                      <Eye className="size-3.5" aria-hidden="true" />
                      Chi tiết
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-stone-500">
                    {orders.length === 0 ? 'Chưa có đơn đặt online nào.' : 'Không có đơn nào khớp với bộ lọc.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedCode(null)}>
        {selected && (
          <DialogContent className="max-w-lg rounded-xl border-stone-200 bg-white p-6 font-sans text-stone-900 shadow-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="flex items-center gap-2 text-xl font-bold text-stone-900">
                  <Globe className="size-5 text-[#5A3E2B]" aria-hidden="true" />
                  Đơn online {selected.orderCode}
                </DialogTitle>
                <Badge className="rounded-full bg-[#5A3E2B] px-2.5 py-0.5 text-xs text-white">{statusLabel(selected)}</Badge>
              </div>
              <DialogDescription className="text-xs text-stone-500">
                Đặt lúc {time(selected.createdAt)} · {selected.contact.fulfilment === 'delivery' ? 'Giao hàng tận nơi' : 'Khách tự đến lấy'} ·{' '}
                {paymentLabels[selected.paymentMethod] ?? selected.paymentMethod} ({selected.paymentStatus === 'paid' ? 'đã thanh toán' : 'chưa thu tiền'})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-xs">
              <dl className="space-y-2 rounded-lg border border-stone-200/90 bg-[#F9F7F4] p-3.5">
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Khách hàng</dt>
                  <dd className="font-bold text-stone-900">{selected.customer}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Số điện thoại</dt>
                  <dd>
                    <a href={`tel:${selected.contact.phone}`} className="font-mono text-stone-800 underline-offset-2 hover:underline">
                      {selected.contact.phone}
                    </a>
                  </dd>
                </div>
                {selected.contact.email && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-stone-500">Email</dt>
                    <dd className="break-all text-stone-800">{selected.contact.email}</dd>
                  </div>
                )}
                {selected.contact.address && (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-stone-500">Địa chỉ giao</dt>
                    <dd className="text-right text-stone-800">{selected.contact.address}</dd>
                  </div>
                )}
                {selected.contact.note && (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-stone-500">Ghi chú</dt>
                    <dd className="text-right text-stone-800">{selected.contact.note}</dd>
                  </div>
                )}
              </dl>

              <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200/90">
                {selected.items.map((item, index) => (
                  <li key={index} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span>
                      <strong className="text-stone-900">{item.name}</strong> × {item.qty}
                      {item.variation && <span className="block text-[11px] text-stone-500">{item.variation}</span>}
                    </span>
                    <span className="font-semibold tabular-nums">{(item.price * item.qty).toLocaleString('vi-VN')} đ</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-stone-200/80 pt-2 text-sm font-bold">
                <span>Tổng thanh toán (gồm VAT)</span>
                <span className="tabular-nums text-[#5A3E2B]">{selected.total.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>

            <DialogFooter className="flex-wrap gap-2 pt-2">
              {selected.paymentStatus !== 'paid' && (
                <Button variant="outline" disabled={pending} onClick={() => collectCash(selected)} className="gap-1.5 text-xs font-semibold">
                  <Banknote className="size-4" aria-hidden="true" />
                  Đã thu tiền
                </Button>
              )}
              {nextStepLabel(selected) && (
                <Button
                  disabled={pending || (selected.status === 'ready' && selected.paymentStatus !== 'paid')}
                  onClick={() => advance(selected)}
                  className="bg-[#5A3E2B] text-xs font-bold text-white hover:bg-[#684732]"
                >
                  {nextStepLabel(selected)}
                </Button>
              )}
            </DialogFooter>
            {selected.status === 'ready' && selected.paymentStatus !== 'paid' && (
              <p className="text-right text-[11px] text-amber-800">Thu tiền trước khi hoàn tất đơn thanh toán khi nhận.</p>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
