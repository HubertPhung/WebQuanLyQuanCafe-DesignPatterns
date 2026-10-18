'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { settleTables } from '@/app/admin/group-payment-actions'
import { Button } from '@/components/ui/button'
import type { FloorTable, Order, PaymentMethod } from '@/lib/db/schema'

export function GroupTablePayment({ tables, orders }: { tables: FloorTable[]; orders: Order[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<number[]>([])
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [tendered, setTendered] = useState('')
  const [pending, startTransition] = useTransition()
  const unpaid = orders.filter(order => order.orderType === 'dine-in' && order.paymentStatus === 'unpaid')
  const orderTables = (order: Order) => order.tableIds?.length ? order.tableIds : order.tableId ? [order.tableId] : []
  const available = tables.filter(table => unpaid.some(order => orderTables(order).includes(table.id)))
  const bills = unpaid.filter(order => orderTables(order).some(id => selected.includes(id)))
  const total = bills.reduce((sum, order) => sum + order.total, 0)

  return <section className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
    <h3 className="font-bold text-stone-900">Gộp bàn thanh toán</h3>
    <p className="text-sm text-stone-500">Chọn các bàn để thu tiền một lần cho toàn bộ hóa đơn chưa thanh toán. Hóa đơn và phiếu bếp vẫn giữ nguyên.</p>
    <div className="flex flex-wrap gap-2">
      {available.map(table => <label key={table.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 p-3 text-sm"><input type="checkbox" disabled={pending} checked={selected.includes(table.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, table.id] : ids.filter(id => id !== table.id))} />{table.name}</label>)}
      {available.length === 0 && <p className="text-sm text-stone-500">Chưa có bàn có hóa đơn chưa thanh toán.</p>}
    </div>
    <p className="text-sm">{bills.length} hóa đơn · Tổng: <strong>{Math.round(total).toLocaleString('vi-VN')} đ</strong></p>
    <div className="flex flex-wrap gap-2">
      <select aria-label="Phương thức thanh toán gộp" disabled={pending} value={method} onChange={event => setMethod(event.target.value as PaymentMethod)} className="rounded-lg border p-2 text-sm"><option value="cash">Tiền mặt</option><option value="qr">QR</option><option value="card">Thẻ</option></select>
      {method === 'cash' && <input aria-label="Tiền khách đưa cho hóa đơn gộp" disabled={pending} type="number" min={0} value={tendered} onChange={event => setTendered(event.target.value)} placeholder="Tiền khách đưa" className="rounded-lg border p-2 text-sm" />}
      <Button disabled={pending || selected.length < 2 || selected.length > 10 || bills.length === 0 || (method === 'cash' && (!tendered || Number(tendered) < total))} onClick={() => startTransition(async () => {
        const result = await settleTables({ tableIds: selected, paymentMethod: method, tenderedAmount: method === 'cash' ? Number(tendered) : undefined, expectedTotal: total })
        if (!result.ok) { toast.error(result.error); router.refresh(); return }
        toast.success(`Đã thanh toán gộp ${result.receipt.total.toLocaleString('vi-VN')} đ`, { description: result.receipt.transactionId })
        for (const warning of result.receipt.warnings ?? []) toast.warning(warning)
        setSelected([]); setTendered(''); router.refresh()
      })}>{pending ? 'Đang thanh toán…' : 'Thanh toán gộp'}</Button>
    </div>
  </section>
}
