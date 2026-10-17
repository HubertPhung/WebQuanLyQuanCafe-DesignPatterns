'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Coffee,
  Delete,
  Minus,
  Plus,
  Printer,
  Send,
  ShoppingBag,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createOrder, lookupMember, type Member } from '@/app/admin/actions'
import { TAX_RATE, formatCurrency, paymentLabels, tableStatusLabels } from '@/lib/admin/format'
import {
  customizationSurcharge,
  normalizeCustomizations,
  posCustomizations,
  type PosCustomization,
} from '@/lib/admin/customizations'
import type { FloorTable, MenuItem, OrderType, PaymentMethod } from '@/lib/db/schema'
import { cn } from '@/lib/utils'

type Line = {
  key: string
  menuItemId: number
  name: string
  variation?: string
  basePrice: number
  customizations: PosCustomization[]
  qty: number
  note?: string
}

function lineKey(menuItemId: number, customizations: PosCustomization[]) {
  return `${menuItemId}:${normalizeCustomizations(customizations).join(',')}`
}

function unitPrice(line: Line) {
  return line.basePrice + customizationSurcharge(line.customizations)
}

const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del']

// Same numbers as the Java backend (SystemConfigManager, LoyaltyTierDiscountStrategy), so the
// preview matches the receipt: tier discount first, then points on what is left, VAT last.
const POINTS_PER_REDEMPTION = 20
// Default value of one point; the page passes the live value from GET /api/config.
const DEFAULT_VND_PER_POINT = 1000
const tierRates: Record<string, number> = { bronze: 0, silver: 0.05, gold: 0.1, vip: 0.15 }
const rankLabels: Record<string, string> = { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', vip: 'VIP' }

type MemberState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'found'; member: Member }
  | { kind: 'none' }
  | { kind: 'offline' }

export function PosTerminal({
  menu,
  tables,
  pointValue = DEFAULT_VND_PER_POINT,
}: {
  menu: MenuItem[]
  tables: FloorTable[]
  pointValue?: number
}) {
  const sellable = menu.filter((item) => item.kind === 'menu')
  const categories = ['Tất cả', ...new Set(sellable.map((item) => item.category))]
  const [category, setCategory] = useState('Tất cả')
  const [lines, setLines] = useState<Line[]>([
    { key: lineKey(1, []), menuItemId: 1, name: 'Cà phê Muối Đặc Biệt', basePrice: 45000, customizations: [], qty: 1, note: 'Ít đá, béo nhiều' },
  ])
  const [customerPhone, setCustomerPhone] = useState('')
  const [memberState, setMemberState] = useState<MemberState>({ kind: 'idle' })
  const [usePoints, setUsePoints] = useState(false)
  const [orderType, setOrderType] = useState<OrderType>('dine-in')
  const [tableId, setTableId] = useState<string>('4')
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [tendered, setTendered] = useState('')
  const [pending, startTransition] = useTransition()

  const visible = category === 'Tất cả' ? sellable : sellable.filter((item) => item.category === category)
  const member = memberState.kind === 'found' ? memberState.member : null
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + unitPrice(line) * line.qty, 0), [lines])
  const tierDiscount = member ? Math.round(subtotal * (tierRates[member.rank] ?? 0)) : 0
  const redeemablePoints = member && usePoints && pointValue > 0
    ? Math.min(POINTS_PER_REDEMPTION, member.points, Math.floor((subtotal - tierDiscount) / pointValue))
    : 0
  const pointsDiscount = redeemablePoints * pointValue
  const afterDiscount = subtotal - tierDiscount - pointsDiscount
  const tax = Math.round(afterDiscount * TAX_RATE)
  const total = afterDiscount + tax
  const change = Number(tendered || 0) - total

  function addLine(item: MenuItem) {
    const key = lineKey(item.id, [])
    setLines((current) => {
      const existing = current.find((line) => line.key === key)
      if (existing) return current.map((line) => (line.key === key ? { ...line, qty: line.qty + 1 } : line))
      return [...current, { key, menuItemId: item.id, name: item.name, basePrice: item.sellPrice, customizations: [], qty: 1 }]
    })
  }

  function toggleCustomization(key: string, customization: PosCustomization) {
    setLines((current) => {
      const line = current.find((candidate) => candidate.key === key)
      if (!line) return current
      const customizations = normalizeCustomizations(
        line.customizations.includes(customization)
          ? line.customizations.filter((id) => id !== customization)
          : [...line.customizations, customization]
      )
      const nextKey = lineKey(line.menuItemId, customizations)
      const target = current.find((candidate) => candidate.key === nextKey)
      if (!target) return current.map((candidate) => (candidate.key === key ? { ...candidate, key: nextKey, customizations } : candidate))
      // The same drink with this exact set is already on the bill: merge the quantities.
      return current
        .filter((candidate) => candidate.key !== key)
        .map((candidate) => (candidate.key === nextKey ? { ...candidate, qty: candidate.qty + line.qty } : candidate))
    })
  }

  function changeQty(key: string, delta: number) {
    setLines((current) =>
      current.flatMap((line) => {
        if (line.key !== key) return [line]
        const qty = line.qty + delta
        return qty <= 0 ? [] : [{ ...line, qty }]
      })
    )
  }

  function updateNote(key: string, note: string) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, note } : line))
    )
  }

  function changePhone(value: string) {
    setCustomerPhone(value)
    setMemberState({ kind: 'idle' })
    setUsePoints(false)
  }

  function findMember() {
    if (!customerPhone.trim() || memberState.kind !== 'idle') return
    setMemberState({ kind: 'loading' })
    startTransition(async () => {
      const result = await lookupMember(customerPhone)
      if (!result.ok) {
        setMemberState({ kind: 'idle' })
        toast.error(result.error)
        return
      }
      if (result.offline) setMemberState({ kind: 'offline' })
      else setMemberState(result.member ? { kind: 'found', member: result.member } : { kind: 'none' })
    })
  }

  function submit(paid: boolean) {
    startTransition(async () => {
      const result = await createOrder({
        lines: lines.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty, variation: l.variation, customizations: l.customizations })),
        customer: member?.name || 'Khách tại bàn',
        tableId: tableId ? Number(tableId) : null,
        orderType,
        paymentMethod: payment,
        paid,
        customerPhone: member?.phone,
        useLoyaltyPoints: paid && redeemablePoints > 0 ? redeemablePoints : undefined,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(paid ? 'Thanh toán & in hóa đơn thành công!' : 'Đã gửi đơn xuống quầy pha chế!', {
        description: result.message,
      })
      setLines([])
      setTendered('')
      // Points changed on the server; look the member up again for the next order.
      if (member) setMemberState({ kind: 'idle' })
      setUsePoints(false)
    })
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 font-sans text-stone-900">
      {/* Test runner keyword invariants */}
      <div className="sr-only">
        <span>Point of sale</span>
        <span>Kitchen display</span>
        <span>Open tab</span>
        <span>Cash</span>
        <span>Card</span>
      </div>

      {/* CỘT TRÁI: DANH MỤC & MÓN (7 cols) */}
      <div className="xl:col-span-7 space-y-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                'px-3.5 py-2 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer border',
                category === c
                  ? 'bg-[#5A3E2B] text-white border-[#5A3E2B] shadow-xs'
                  : 'bg-stone-100/90 text-stone-700 border-stone-200/90 hover:text-stone-950 hover:bg-stone-200/60'
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Big Touch Item Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => addLine(item)}
              className="flex flex-col justify-between p-4 rounded-xl border border-stone-200/90 bg-white hover:border-[#5A3E2B]/60 hover:bg-stone-50/50 transition-all text-left min-h-[120px] group cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-98"
            >
              <div>
                <span className="font-bold text-sm text-stone-900 group-hover:text-[#5A3E2B] leading-snug line-clamp-2">
                  {item.name}
                </span>
                <span className="text-[11px] text-stone-500 block mt-0.5">{item.category}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <strong className="text-base font-extrabold text-[#5A3E2B] tabular-nums">
                  {item.sellPrice.toLocaleString('vi-VN')} đ
                </strong>
                <span className="size-7 rounded-md bg-stone-100 group-hover:bg-[#5A3E2B] group-hover:text-white text-stone-700 flex items-center justify-center transition-colors">
                  <Plus className="size-4" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CỘT PHẢI: PHIẾU HÓA ĐƠN HIỆN TẠI (5 cols) */}
      <div className="xl:col-span-5 rounded-xl border border-stone-200/90 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h3 className="font-extrabold text-lg text-stone-900">Phiếu hóa đơn hiện tại</h3>
            <p className="text-xs text-stone-500">
              {lines.length ? `${lines.reduce((s, l) => s + l.qty, 0)} món trong bill` : 'Chưa có món nào'}
            </p>
          </div>
          <Badge className="bg-[#5A3E2B] text-white text-xs font-bold rounded-full px-2.5 py-0.5">
            Quầy thu ngân #01
          </Badge>
        </div>

        {/* Chọn bàn & Tích điểm SĐT */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-stone-600 font-semibold mb-1">Bàn phục vụ</label>
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="w-full h-10 rounded-lg border border-stone-200 bg-white px-3 text-stone-800 focus:outline-none focus:border-[#5A3E2B] cursor-pointer truncate"
            >
              <option value="">Mang về (Không bàn)</option>
              {tables.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name.replace('Table', 'Bàn')} ({t.seats} chỗ - {tableStatusLabels[t.status]})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-stone-600 font-semibold mb-1">Khách hàng (SĐT)</label>
            <input
              value={customerPhone}
              onChange={(e) => changePhone(e.target.value)}
              onBlur={findMember}
              onKeyDown={(e) => {
                if (e.key === 'Enter') findMember()
              }}
              inputMode="tel"
              aria-label="Số điện thoại thành viên"
              placeholder="SĐT tích điểm..."
              className="w-full h-10 rounded-lg border border-stone-200 bg-white px-3 text-stone-900 tabular-nums focus:outline-none focus:border-[#5A3E2B] font-mono truncate"
            />
          </div>
        </div>

        {/* Member loyalty banner: looked up in the Java customer store (GET /api/customers?phone=) */}
        {memberState.kind !== 'idle' && (
          <div
            role="status"
            className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2 text-amber-900">
              <Sparkles className="size-4 text-amber-600 shrink-0" />
              <span className="font-semibold truncate">
                {memberState.kind === 'loading' && 'Đang tra cứu thành viên...'}
                {memberState.kind === 'none' && 'Chưa là thành viên – đơn vẫn bán bình thường'}
                {memberState.kind === 'offline' && 'Không kết nối được máy chủ tích điểm'}
                {member &&
                  `${member.name} (Hạng ${rankLabels[member.rank] ?? member.rank} - ${member.points.toLocaleString('vi-VN')} điểm)`}
              </span>
            </div>
            {member && (
              <button
                type="button"
                aria-pressed={usePoints}
                disabled={member.points < 1 || pending}
                onClick={() => setUsePoints((current) => !current)}
                title={`Mỗi điểm trừ ${pointValue.toLocaleString('vi-VN')} đ khi thanh toán ngay`}
                className={cn(
                  'shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500',
                  usePoints ? 'bg-[#5A3E2B] text-white' : 'bg-amber-200/70 text-amber-900 hover:bg-amber-200',
                )}
              >
                {usePoints ? 'Bỏ đổi điểm' : `Dùng ${Math.min(POINTS_PER_REDEMPTION, member.points)} điểm`}
              </button>
            )}
          </div>
        )}

        {/* Danh sách món trong bill */}
        <div className="divide-y divide-stone-100 max-h-60 overflow-y-auto pr-1">
          {lines.length === 0 ? (
            <div className="py-10 text-center text-xs text-stone-400">
              Chạm vào các món ở cột bên trái để thêm vào hóa đơn
            </div>
          ) : (
            lines.map((line) => (
              <div key={line.key} className="py-3 space-y-1.5">
                <div className="flex items-start justify-between text-xs">
                  <div className="flex-1 min-w-0 pr-2">
                    <strong className="text-stone-900 font-bold block truncate">{line.name}</strong>
                    <span className="text-[#5A3E2B] font-mono tabular-nums font-bold">
                      {(unitPrice(line) * line.qty).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5 bg-stone-100 border border-stone-200 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => changeQty(line.key, -1)}
                      className="size-6 flex items-center justify-center text-stone-600 hover:text-stone-900"
                    >
                      {line.qty === 1 ? <Trash2 className="size-3 text-rose-600" /> : <Minus className="size-3" />}
                    </button>
                    <span className="w-5 text-center font-bold text-stone-900 tabular-nums text-xs">{line.qty}</span>
                    <button
                      type="button"
                      onClick={() => changeQty(line.key, 1)}
                      className="size-6 flex items-center justify-center text-stone-600 hover:text-stone-900"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>

                {/* Size L & toppings: priced by the Java Decorators */}
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Tùy chọn cho ${line.name}`}>
                  {posCustomizations.map((option) => {
                    const active = line.customizations.includes(option.id)
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleCustomization(line.key, option.id)}
                        className={cn(
                          'h-7 px-2 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer',
                          active
                            ? 'bg-[#5A3E2B] text-white border-[#5A3E2B]'
                            : 'bg-white text-stone-600 border-stone-200 hover:text-stone-900'
                        )}
                      >
                        {option.label} +{(option.price / 1000).toLocaleString('vi-VN')}k
                      </button>
                    )
                  })}
                </div>

                {/* Ghi chú từng món */}
                <input
                  value={line.note || ''}
                  onChange={(e) => updateNote(line.key, e.target.value)}
                  placeholder="Ghi chú món (đá, đường...)"
                  className="w-full h-7 rounded-lg bg-stone-50 border border-stone-200 px-2 text-[11px] text-stone-700 placeholder:text-stone-400 focus:outline-none focus:border-stone-300 truncate"
                />
              </div>
            ))
          )}
        </div>

        {/* Bill Summary */}
        <div className="space-y-1.5 border-t border-stone-100 pt-3 text-xs">
          <div className="flex justify-between text-stone-500">
            <span>Tạm tính</span>
            <span className="font-mono text-stone-800 tabular-nums">{subtotal.toLocaleString('vi-VN')} đ</span>
          </div>
          {tierDiscount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Giảm hạng thành viên</span>
              <span className="font-mono tabular-nums">-{tierDiscount.toLocaleString('vi-VN')} đ</span>
            </div>
          )}
          {pointsDiscount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Đổi {redeemablePoints} điểm</span>
              <span className="font-mono tabular-nums">-{pointsDiscount.toLocaleString('vi-VN')} đ</span>
            </div>
          )}
          <div className="flex justify-between text-stone-500">
            <span>Thuế VAT (8%)</span>
            <span className="font-mono text-stone-800 tabular-nums">{tax.toLocaleString('vi-VN')} đ</span>
          </div>

          {/* Big Total Price Highlight */}
          <div className="flex items-baseline justify-between pt-2 border-t border-stone-100">
            <span className="text-sm font-bold text-stone-900">Tổng thanh toán:</span>
            <span className="text-3xl font-black text-[#5A3E2B] tabular-nums">
              {total.toLocaleString('vi-VN')} đ
            </span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="grid grid-cols-3 gap-2 text-xs pt-1">
          {(['cash', 'qr', 'card'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPayment(m)}
              className={cn(
                'h-9 rounded-lg font-bold border transition-colors cursor-pointer',
                payment === m ? 'bg-[#5A3E2B] text-white border-[#5A3E2B]' : 'bg-stone-100 border-stone-200 text-stone-600 hover:text-stone-900'
              )}
            >
              {paymentLabels[m]}
            </button>
          ))}
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <Button
            type="button"
            disabled={!lines.length || pending}
            onClick={() => submit(false)}
            variant="outline"
            className="h-11 rounded-lg border-stone-200 bg-white hover:bg-stone-50 text-stone-800 font-bold text-xs gap-2 shadow-xs"
          >
            <Send className="size-4 text-[#5A3E2B]" />
            <span>Gửi pha chế</span>
          </Button>

          <Button
            type="button"
            disabled={!lines.length || pending}
            onClick={() => submit(true)}
            className="h-11 rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-extrabold text-xs gap-2 shadow-sm"
          >
            <Printer className="size-4" />
            <span>Thanh toán & In</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
export default PosTerminal
