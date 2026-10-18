'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { DemoNotice } from '@/components/admin/shared'
import {
  AlertTriangle,
  Armchair,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  DollarSign,
  Flame,
  LayoutGrid,
  Package,
  PackageX,
  Phone,
  Plus,
  Printer,
  Receipt,
  Sparkles,
  TrendingUp,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { updateOrderStatus, updateTableStatus } from '@/app/admin/actions'
import { formatCurrency, formatElapsed, tableStatusLabels } from '@/lib/admin/format'
import type { FloorTable, MenuItem, Order, OrderStatus, TableStatus } from '@/lib/db/schema'
import { cn } from '@/lib/utils'

// Default fallback data if server props are undefined
const defaultTables: FloorTable[] = [
  { id: 12, name: 'Bar 01', seats: 1, zone: 'Quầy Bar', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date() },
  { id: 13, name: 'Bar 02', seats: 1, zone: 'Quầy Bar', status: 'occupied', guestCount: 1, occupiedSince: new Date(Date.now() - 15 * 60000), updatedAt: new Date() },
  { id: 14, name: 'Bar 03', seats: 1, zone: 'Quầy Bar', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date() },
  { id: 15, name: 'Bar 04', seats: 1, zone: 'Quầy Bar', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date() },
  { id: 1, name: 'Bàn 01', seats: 2, zone: 'Phòng lạnh', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date() },
  { id: 2, name: 'Bàn 02', seats: 4, zone: 'Phòng lạnh', status: 'occupied', guestCount: 3, occupiedSince: new Date(Date.now() - 35 * 60000), updatedAt: new Date() },
  { id: 3, name: 'Bàn 03', seats: 4, zone: 'Phòng lạnh', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date() },
  { id: 4, name: 'Bàn 04', seats: 2, zone: 'Phòng lạnh', status: 'reserved', guestCount: 2, occupiedSince: null, updatedAt: new Date() },
  { id: 5, name: 'Bàn 05', seats: 6, zone: 'Phòng lạnh', status: 'occupied', guestCount: 5, occupiedSince: new Date(Date.now() - 75 * 60000), updatedAt: new Date() },
  { id: 6, name: 'Bàn 06', seats: 4, zone: 'Phòng lạnh', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date() },
  { id: 7, name: 'Vườn 01', seats: 4, zone: 'Sân vườn', status: 'occupied', guestCount: 4, occupiedSince: new Date(Date.now() - 50 * 60000), updatedAt: new Date() },
  { id: 8, name: 'Vườn 02', seats: 2, zone: 'Sân vườn', status: 'cleaning', guestCount: 0, occupiedSince: null, updatedAt: new Date() },
  { id: 9, name: 'Vườn 03', seats: 4, zone: 'Sân vườn', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date() },
  { id: 10, name: 'Vườn 04', seats: 2, zone: 'Sân vườn', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date() },
  { id: 11, name: 'Vườn 05', seats: 2, zone: 'Sân vườn', status: 'reserved', guestCount: 2, occupiedSince: null, updatedAt: new Date() },
]

const defaultOrders: Order[] = [
  {
    id: 101,
    orderCode: 'AC-0101',
    customer: 'Hoàng Thùy Linh',
    tableId: null,
    orderType: 'pickup',
    items: [
      { name: 'Cà phê Latte Vani Mịn', qty: 1, price: 55000, variation: 'Sữa yến mạch' },
      { name: 'Bánh Croissant Bơ Pháp', qty: 1, price: 45000, variation: 'Nóng giòn' },
    ],
    subtotal: 100000,
    total: 108000,
    paymentMethod: 'card',
    paymentStatus: 'paid',
    status: 'pending',
    createdAt: new Date(Date.now() - 4 * 60000),
    completedAt: null,
  },
  {
    id: 102,
    orderCode: 'AC-0102',
    customer: 'Trần Minh Quân',
    tableId: 2,
    orderType: 'dine-in',
    items: [
      { name: 'Cà phê Muối Đặc Biệt', qty: 2, price: 45000 },
      { name: 'Bạc Xỉu Sữa Tươi', qty: 1, price: 45000, variation: 'Ít ngọt' },
      { name: 'Bánh Chuối Óc Chó Thủ Công', qty: 1, price: 38000 },
    ],
    subtotal: 173000,
    total: 186840,
    paymentMethod: 'qr',
    paymentStatus: 'paid',
    status: 'brewing',
    createdAt: new Date(Date.now() - 8 * 60000),
    completedAt: null,
  },
  {
    id: 103,
    orderCode: 'AC-0103',
    customer: 'Khách tại quầy Bar 02',
    tableId: 13,
    orderType: 'dine-in',
    items: [
      { name: 'Cà phê Pour Over Guji Ethiopia', qty: 1, price: 65000, variation: 'V60 đá' },
    ],
    subtotal: 65000,
    total: 70200,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    status: 'ready',
    createdAt: new Date(Date.now() - 12 * 60000),
    completedAt: null,
  },
]

const sparklineData = [
  { time: '07:00', revenue: 95000 },
  { time: '08:30', revenue: 210000 },
  { time: '10:00', revenue: 420000 },
  { time: '11:30', revenue: 580000 },
  { time: '13:00', revenue: 690000 },
  { time: '14:30', revenue: 775000 },
]

const topSellers = [
  { name: 'Nước cam tươi nguyên chất', sold: 42, revenue: '189.000 đ', percent: 85 },
  { name: 'Cơm chiên hoàng bào', sold: 28, revenue: '196.000 đ', percent: 70 },
  { name: 'Cà phê Americano đá', sold: 35, revenue: '140.000 đ', percent: 65 },
  { name: 'Bánh Croissant bơ Pháp', sold: 25, revenue: '125.000 đ', percent: 55 },
]

export interface DashboardOperationalViewProps {
  initialTables?: FloorTable[]
  initialOrders?: Order[]
  overview?: any
  menuItems?: MenuItem[]
}

export function DashboardOperationalView({
  initialTables,
  initialOrders,
}: DashboardOperationalViewProps) {
  // Normalize tables with zone mapping
  // Sample data only when the page passed nothing at all; an empty list is a real, quiet shop.
  const normalizedTables = (initialTables ?? defaultTables).map((t) => {
    let zone = t.zone
    if (zone === 'Coffee Bar') zone = 'Quầy Bar'
    if (zone === 'Main Floor') zone = 'Phòng lạnh'
    if (zone === 'Patio') zone = 'Sân vườn'
    return { ...t, zone }
  })

  const [tables, setTables] = useState<FloorTable[]>(normalizedTables)
  const [orders, setOrders] = useState<Order[]>(initialOrders ?? defaultOrders)
  const [selectedZone, setSelectedZone] = useState<string>('all')
  const [activeTableDetail, setActiveTableDetail] = useState<FloorTable | null>(null)
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  // Compute live operational metrics
  const activeOrdersCount = orders.filter((o) => o.status !== 'completed').length
  const brewingOrdersCount = orders.filter((o) => o.status === 'brewing' || o.status === 'pending').length
  const overdueTablesCount = tables.filter((t) => {
    if (t.status !== 'occupied' || !t.occupiedSince) return false
    const elapsedMinutes = (Date.now() - new Date(t.occupiedSince).getTime()) / 60000
    return elapsedMinutes > 60
  }).length

  const availableCount = tables.filter((t) => t.status === 'available').length
  const occupiedCount = tables.filter((t) => t.status === 'occupied').length
  const reservedCount = tables.filter((t) => t.status === 'reserved').length

  const filteredTables = selectedZone === 'all' ? tables : tables.filter((t) => t.zone === selectedZone)
  // Zone tabs follow the zones the floor plan really has.
  const zones = [...new Set(tables.map((t) => t.zone))]

  // Handle live ticket progression
  const handleAdvanceOrder = (orderId: number, nextStatus: OrderStatus) => {
    startTransition(async () => {
      // Optimistic update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      )
      const res = await updateOrderStatus(orderId, nextStatus)
      if (res.ok) {
        const label =
          nextStatus === 'brewing'
            ? 'Bắt đầu pha chế vé #'
            : nextStatus === 'ready'
            ? 'Báo chuông hoàn thành vé #'
            : 'Đã hoàn tất & giao vé #'
        toast.success(`${label}${orders.find((o) => o.id === orderId)?.orderCode || orderId}`)
      } else {
        toast.error(res.error || 'Cập nhật vé thất bại')
      }
    })
  }

  // Handle table quick status change
  const handleSetTableStatus = (tableId: number, newStatus: TableStatus) => {
    startTransition(async () => {
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? {
                ...t,
                status: newStatus,
                occupiedSince: newStatus === 'occupied' ? new Date() : null,
                guestCount: newStatus === 'occupied' ? 2 : 0,
              }
            : t
        )
      )
      setActiveTableDetail(null)
      const res = await updateTableStatus(tableId, newStatus, newStatus === 'occupied' ? 2 : 0)
      if (res.ok) {
        toast.success(`Đã cập nhật trạng thái bàn sang "${tableStatusLabels[newStatus]}"`)
      } else {
        toast.error(res.error || 'Không thể đổi trạng thái bàn')
      }
    })
  }

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header Operational Context Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white rounded-xl border border-stone-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-4 md:p-5">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full bg-stone-100/90 px-3 py-1 text-xs font-semibold text-stone-800">
              <span className="size-2 rounded-full bg-[#5A3E2B]" />
              Ca sáng · Thứ Ba, 14/10/2026
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              {brewingOrdersCount} đơn đang pha chế · {overdueTablesCount} bàn quá giờ
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-stone-500 pt-0.5">
            <span>Trưởng ca: <strong className="text-stone-700 font-semibold">Nguyễn Hoàng Nam</strong></span>
            <span className="text-stone-300">·</span>
            <span>Khung giờ: 06:30 - 14:30</span>
            <span className="text-stone-300">·</span>
            <span className="text-emerald-700 font-medium">Trực tiếp từ POS & KDS</span>
          </div>
        </div>

        {/* Operational Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/admin/pos"
            className="h-10 rounded-lg bg-white text-stone-800 shadow-2xs hover:bg-stone-50 border border-stone-200/80 font-semibold text-xs gap-1.5 px-3.5 flex items-center justify-center transition-colors"
          >
            <Receipt className="size-3.5 text-[#5A3E2B]" />
            <span>Mở bill bàn</span>
          </Link>

          <Link
            href="/admin/inventory"
            className="h-10 rounded-lg bg-white text-stone-800 shadow-2xs hover:bg-stone-50 border border-stone-200/80 font-semibold text-xs gap-1.5 px-3.5 flex items-center justify-center transition-colors"
          >
            <Package className="size-3.5 text-[#5A3E2B]" />
            <span>Xuất kho định lượng</span>
          </Link>

          <Button
            onClick={() => setIsShiftModalOpen(true)}
            className="h-10 rounded-lg bg-[#5A3E2B] text-white hover:bg-[#684732] shadow-xs font-semibold text-xs gap-1.5 px-4 cursor-pointer"
          >
            <Printer className="size-3.5" />
            <span>Chốt ca & in báo cáo</span>
            <DemoNotice compact />
          </Button>
        </div>
      </div>

      {/* 2. Main 70% / 30% Master Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT 70%: LIVE OPERATIONS STREAM (Sơ đồ bàn & KDS Queue) */}
        {/* ======================================================== */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section A: Sơ đồ bàn theo khu vực thực tế (Zoned Cafe Floor Layout) */}
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-5 md:p-6 space-y-5">
            {/* Floor Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-stone-200/50">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Armchair className="size-5 text-[#5A3E2B]" />
                  <h3 className="text-base font-bold text-stone-900 tracking-tight">
                    Sơ đồ bàn hoạt động trực tiếp
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 font-bold text-stone-700 tabular-nums">
                    {tables.length} vị trí
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  Phân bố theo 3 phân khu phục vụ thực tế: Quầy Bar, Phòng lạnh & Sân vườn.
                </p>
              </div>

              {/* Status breakdown pills */}
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800">
                  <span className="size-1.5 rounded-full bg-emerald-600" />
                  {availableCount} Trống
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-900">
                  <span className="size-1.5 rounded-full bg-amber-600" />
                  {occupiedCount} Đang dùng
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800">
                  <span className="size-1.5 rounded-full bg-sky-600" />
                  {reservedCount} Đã đặt
                </span>
              </div>
            </div>

            {/* Zone Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-stone-100/70 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setSelectedZone('all')}
                className={cn(
                  'px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer',
                  selectedZone === 'all'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                )}
              >
                Tất cả khu vực ({tables.length})
              </button>
              {zones.map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => setSelectedZone(zone)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5',
                    selectedZone === zone ? 'bg-white text-[#5A3E2B] shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                  )}
                >
                  <span>{zone}</span>
                  <span className="text-[10px] text-stone-400">({tables.filter((t) => t.zone === zone).length})</span>
                </button>
              ))}
            </div>

            {/* Table Floor Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredTables.map((table) => {
                const isOccupied = table.status === 'occupied'
                const isReserved = table.status === 'reserved'
                const isCleaning = table.status === 'cleaning'
                const elapsedMins = table.occupiedSince
                  ? Math.floor((Date.now() - new Date(table.occupiedSince).getTime()) / 60000)
                  : 0
                const isOverdue = isOccupied && elapsedMins > 60

                // Attached order if occupied
                const matchingOrder = isOccupied
                  ? orders.find((o) => o.tableId === table.id && o.status !== 'completed')
                  : null

                return (
                  <div
                    key={table.id}
                    onClick={() => setActiveTableDetail(table)}
                    className={cn(
                      'group rounded-lg p-3 text-left transition-all cursor-pointer relative',
                      'shadow-2xs hover:shadow-md hover:-translate-y-0.5',
                      isOccupied && !isOverdue && 'bg-amber-500/10 ring-1 ring-amber-300/60',
                      isOverdue && 'bg-rose-50 ring-1 ring-rose-300/80',
                      isReserved && 'bg-sky-50/80 ring-1 ring-sky-200/80',
                      isCleaning && 'bg-stone-100/90 text-stone-600',
                      table.status === 'available' && 'bg-emerald-50/70 hover:bg-emerald-50/90'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="font-extrabold text-sm text-stone-900 tracking-tight">
                        {table.name}
                      </span>
                      <span className="text-[10px] font-semibold text-stone-500 flex items-center gap-0.5">
                        <Users className="size-3" />
                        {table.seats}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      {table.status === 'available' && (
                        <div className="text-[11px] font-semibold text-emerald-800 flex items-center justify-between">
                          <span>Bàn trống</span>
                          <span className="text-[10px] text-stone-400 group-hover:text-emerald-700">+ Mở bill</span>
                        </div>
                      )}

                      {isOccupied && (
                        <>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-amber-950">
                              {table.guestCount || 2} khách
                            </span>
                            <span className={cn('font-mono text-[10px] font-bold', isOverdue ? 'text-rose-700' : 'text-amber-800')}>
                              {elapsedMins}p
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-[#5A3E2B] truncate tabular-nums">
                            {matchingOrder ? formatCurrency(matchingOrder.total) : '145.000 đ'}
                          </div>
                          {isOverdue && (
                            <span className="inline-block px-1.5 py-0.2 rounded bg-rose-200 text-rose-900 text-[9px] font-extrabold">
                              Quá giờ
                            </span>
                          )}
                        </>
                      )}

                      {isReserved && (
                        <div className="text-[10px] text-sky-900 font-semibold leading-tight">
                          <span>Đã đặt trước</span>
                          <span className="block text-sky-700">Khung 18:30</span>
                        </div>
                      )}

                      {isCleaning && (
                        <div className="text-[10px] text-stone-600 font-medium leading-tight">
                          <span>Đang dọn bàn</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Section B: Hàng đợi pha chế Barista thời gian thực (Live Barista Fulfillment Queue) */}
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-5 md:p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-stone-200/50">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                  <Coffee className="size-5 text-[#5A3E2B] shrink-0" />
                  <h3 className="text-base font-bold text-stone-900 tracking-tight">
                    Hàng đợi pha chế Barista (Live Fulfillment Queue)
                  </h3>
                  <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-amber-100 font-bold text-amber-950 tabular-nums whitespace-nowrap shrink-0">
                    {orders.filter((o) => o.status !== 'completed').length} vé đang xử lý
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  Cập nhật liên tục từ màn hình order thu ngân POS và khách đặt tại bàn.
                </p>
              </div>

              <Link
                href="/admin/pos?tab=kitchen"
                className="h-8 text-xs font-semibold text-[#5A3E2B] hover:text-[#684732] hover:bg-stone-100 px-3 inline-flex items-center gap-1.5 rounded-lg border border-stone-200/60 shadow-2xs transition-colors whitespace-nowrap shrink-0 self-start lg:self-center"
              >
                <span>Màn hình Bếp/Bar đầy đủ</span>
                <ArrowRight className="size-3.5 shrink-0" />
              </Link>
            </div>

            {/* Tickets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {orders
                .filter((o) => o.status !== 'completed')
                .slice(0, 6)
                .map((order) => {
                  const elapsedMinutes = Math.floor(
                    (Date.now() - new Date(order.createdAt).getTime()) / 60000
                  )
                  const isPending = order.status === 'pending'
                  const isBrewing = order.status === 'brewing'
                  const isReady = order.status === 'ready'

                  return (
                    <div
                      key={order.id}
                      className={cn(
                        'rounded-lg p-3.5 space-y-3 shadow-2xs transition-all flex flex-col justify-between border border-stone-200/60',
                        isPending && 'bg-stone-50/80 border-l-4 border-l-amber-500',
                        isBrewing && 'bg-blue-50/50 border-l-4 border-l-blue-500',
                        isReady && 'bg-emerald-50/50 border-l-4 border-l-emerald-500'
                      )}
                    >
                      <div className="space-y-2">
                        {/* Ticket Code & Time */}
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-black text-stone-900 tracking-wider">
                            #{order.orderCode}
                          </span>
                          <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1 tabular-nums">
                            <Clock className="size-3" />
                            {elapsedMinutes}p trước
                          </span>
                        </div>

                        {/* Customer / Location Tag */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-stone-800 truncate max-w-[140px]">
                            {order.customer}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white text-stone-700 shadow-2xs border border-stone-200/60">
                            {order.orderType === 'dine-in'
                              ? `Bàn ${order.tableId ? String(order.tableId).padStart(2, '0') : '02'}`
                              : 'Mang đi'}
                          </span>
                        </div>

                        {/* Items list */}
                        <div className="space-y-1 pt-1 border-t border-stone-200/50 text-xs">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-start justify-between gap-1 leading-snug">
                              <span className="text-stone-800">
                                <strong className="text-stone-950 font-bold tabular-nums">{item.qty}x</strong>{' '}
                                {item.name}
                                {item.variation && (
                                  <span className="text-[10px] text-stone-500 block">
                                    ({item.variation})
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Ticket Action Button */}
                      <div className="pt-2">
                        {isPending && (
                          <Button
                            onClick={() => handleAdvanceOrder(order.id, 'brewing')}
                            disabled={pending}
                            className="w-full h-8.5 rounded-md bg-[#5A3E2B] text-white hover:bg-[#684732] text-xs font-semibold cursor-pointer shadow-xs"
                          >
                            Bắt đầu pha chế
                          </Button>
                        )}
                        {isBrewing && (
                          <Button
                            onClick={() => handleAdvanceOrder(order.id, 'ready')}
                            disabled={pending}
                            className="w-full h-8.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold cursor-pointer shadow-xs"
                          >
                            Báo hoàn thành
                          </Button>
                        )}
                        {isReady && (
                          <Button
                            onClick={() => handleAdvanceOrder(order.id, 'completed')}
                            disabled={pending}
                            className="w-full h-8.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold cursor-pointer shadow-xs"
                          >
                            Giao món & Hoàn tất
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT 30%: SLEEK COMPACT SIDE PANEL (Thước đo & Cảnh báo) */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Tóm tắt dòng tiền ca trực (Shift Financial Pulse) */}
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                  Dòng tiền ca trực <DemoNotice compact />
                </h4>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-stone-900 tabular-nums">
                    775.000 đ
                  </span>
                  <span className="text-xs font-bold text-emerald-700">
                    +18.4%
                  </span>
                </div>
              </div>
              <div className="size-9 rounded-lg bg-amber-500/10 text-[#5A3E2B] flex items-center justify-center">
                <DollarSign className="size-4.5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="rounded-lg bg-stone-50 p-2.5 border border-stone-200/60">
                <span className="text-stone-500 text-[11px] block">Đơn hoàn thành</span>
                <span className="text-sm font-bold text-stone-900 tabular-nums">28 đơn</span>
              </div>
              <div className="rounded-lg bg-stone-50 p-2.5 border border-stone-200/60">
                <span className="text-stone-500 text-[11px] block">Giá trị TB/đơn</span>
                <span className="text-sm font-bold text-stone-900 tabular-nums">27.600 đ</span>
              </div>
            </div>

            {/* Sparkline Area Chart */}
            <div className="h-28 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5A3E2B" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#5A3E2B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', fontSize: '11px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                    formatter={(val: any) => [`${Number(val).toLocaleString('vi-VN')} đ`, 'Doanh thu tích lũy']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#5A3E2B"
                    strokeWidth={2.5}
                    fill="url(#sparkGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Payment method split pill */}
            <div className="space-y-1.5 pt-1 border-t border-stone-200/50">
              <div className="flex items-center justify-between text-[11px] font-semibold text-stone-600">
                <span>Phương thức</span>
                <span>Tiền mặt 45% · QR 35% · Thẻ 20%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden flex">
                <div className="bg-[#5A3E2B] h-full" style={{ width: '45%' }} />
                <div className="bg-[#C88A58] h-full" style={{ width: '35%' }} />
                <div className="bg-blue-600 h-full" style={{ width: '20%' }} />
              </div>
            </div>
          </div>

          {/* Card 2: Cảnh báo kho nguyên liệu Actionable Toasts (Direct Shortcut Alerts) */}
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-rose-600" />
                Cảnh báo kho nguyên liệu <DemoNotice compact />
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-900">
                3 mục
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Alert 1: Đã hết hạn */}
              <div className="rounded-lg p-3 bg-rose-50/70 border border-rose-200/70 space-y-2">
                <div className="flex items-start gap-2.5">
                  <PackageX className="size-4 text-rose-700 shrink-0 mt-0.5" />
                  <div className="min-w-0 text-xs">
                    <strong className="text-rose-900 font-bold block text-xs">
                      Thịt bò tươi - Đã hết hạn
                    </strong>
                    <p className="text-rose-800 text-[11px] mt-0.5 leading-snug">
                      Lô ngày 05/10 đã quá hạn hôm qua. Cần lập biên bản tiêu hủy.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => toast.success('Đã xuất biên bản tiêu hủy lô Thịt bò tươi #EXP-0510!')}
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-md text-[11px] font-semibold text-rose-800 bg-white hover:bg-rose-100 border-rose-200 cursor-pointer"
                  >
                    Xuất hủy & Ghi biên bản
                  </Button>
                </div>
              </div>

              {/* Alert 2: Gần hết hạn */}
              <div className="rounded-lg p-3 bg-amber-500/10 border border-amber-300/60 space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="size-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="min-w-0 text-xs">
                    <strong className="text-amber-950 font-bold block text-xs">
                      Cam tươi sành - Hạn còn 2 ngày
                    </strong>
                    <p className="text-amber-900 text-[11px] mt-0.5 leading-snug">
                      Còn 12.5 kg. Khuyến nghị ưu tiên đề xuất món Nước cam ép hôm nay.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => toast.success('Đã bật huy hiệu ưu tiên món Nước cam tươi trên màn hình POS!')}
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-md text-[11px] font-semibold text-amber-900 bg-white hover:bg-amber-100 border-amber-300 cursor-pointer"
                  >
                    Đẩy menu gợi ý
                  </Button>
                </div>
              </div>

              {/* Alert 3: Tồn kho dưới định mức */}
              <div className="rounded-lg p-3 bg-stone-100/90 border border-stone-200/80 space-y-2">
                <div className="flex items-start gap-2.5">
                  <Package className="size-4 text-[#5A3E2B] shrink-0 mt-0.5" />
                  <div className="min-w-0 text-xs">
                    <strong className="text-stone-900 font-bold block text-xs">
                      Bơ lạt Anchor - Sắp hết kho
                    </strong>
                    <p className="text-stone-600 text-[11px] mt-0.5 leading-snug">
                      Còn 5.0 kg (chạm ngưỡng báo động). Cần nhập bổ sung ca chiều.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => toast.success('Đã gửi đề xuất nhập kho 20kg Bơ lạt Anchor tới nhà cung cấp!')}
                    size="sm"
                    className="h-7 rounded-md text-[11px] font-semibold bg-[#5A3E2B] text-white hover:bg-[#684732] cursor-pointer"
                  >
                    Nhập hàng ngay
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Top món bán chạy ca trực (Shift Top Performers) */}
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Flame className="size-3.5 text-[#C88A58]" />
                Top món bán chạy ca trực <DemoNotice compact />
              </h4>
              <span className="text-[10px] text-stone-400 font-semibold">Theo số lượng</span>
            </div>

            <div className="space-y-3">
              {topSellers.map((item, idx) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-800 flex items-center gap-1.5 truncate max-w-[170px]">
                      <span className="size-4 rounded-md bg-stone-100 text-[#5A3E2B] flex items-center justify-center text-[10px] font-black">
                        {idx + 1}
                      </span>
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="text-[11px] font-bold text-stone-900 tabular-nums">
                      {item.sold} ly
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#C88A58] to-[#5A3E2B]"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 4: Lịch đặt bàn tiếp theo (Upcoming Reservations) */}
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                Lịch khách đặt sắp tới <DemoNotice compact />
              </h4>
              <Link href="/admin/reservations" className="text-[11px] font-semibold text-[#5A3E2B] hover:underline">
                Xem tất cả
              </Link>
            </div>

            <div className="space-y-2.5">
              <div className="rounded-lg p-2.5 bg-stone-50 border border-stone-200/60 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-stone-900">Nguyễn Hoàng Nam · 4 khách</div>
                  <span className="text-[11px] text-stone-500 block">15:06 - 17:07 · Bàn 04 (Phòng lạnh)</span>
                </div>
                <Button
                  onClick={() => toast.success('Đã xác nhận sẵn sàng đón khách Nguyễn Hoàng Nam!')}
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] font-semibold text-[#5A3E2B] bg-white border-stone-200 rounded-md"
                >
                  Đón khách
                </Button>
              </div>

              <div className="rounded-lg p-2.5 bg-stone-50 border border-stone-200/60 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-stone-900">Trần Thu Hà · 2 khách</div>
                  <span className="text-[11px] text-stone-500 block">18:00 - 20:00 · Bàn 07 (Sân vườn)</span>
                </div>
                <Button
                  onClick={() => toast.success('Đã xác nhận sẵn sàng đón khách Trần Thu Hà!')}
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] font-semibold text-[#5A3E2B] bg-white border-stone-200 rounded-md"
                >
                  Đón khách
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Interactive Table Quick Inspector Modal */}
      {activeTableDetail && (
        <Dialog open={!!activeTableDetail} onOpenChange={(open) => !open && setActiveTableDetail(null)}>
          <DialogContent className="max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-lg font-bold text-stone-900 flex items-center justify-between">
                <span>{activeTableDetail.name} · {activeTableDetail.zone}</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700">
                  {activeTableDetail.seats} chỗ ngồi
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-stone-500">
                Trạng thái hiện tại: <strong className="text-stone-800">{tableStatusLabels[activeTableDetail.status]}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-stone-50 border border-stone-200/60">
                <div>
                  <span className="text-stone-500 text-[11px] block">Số khách đang ngồi</span>
                  <strong className="text-sm text-stone-900">{activeTableDetail.guestCount || 0} người</strong>
                </div>
                <div>
                  <span className="text-stone-500 text-[11px] block">Thời gian khách dùng</span>
                  <strong className="text-sm text-stone-900">
                    {activeTableDetail.occupiedSince ? formatElapsed(activeTableDetail.occupiedSince) : 'Chưa có khách'}
                  </strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-semibold text-stone-700 block">Thao tác nhanh cho bàn:</span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleSetTableStatus(activeTableDetail.id, 'available')}
                    variant="outline"
                    className="h-9 text-xs rounded-lg border-emerald-300 text-emerald-800 hover:bg-emerald-50 cursor-pointer font-semibold"
                  >
                    Chuyển thành Bàn trống
                  </Button>
                  <Button
                    onClick={() => handleSetTableStatus(activeTableDetail.id, 'occupied')}
                    variant="outline"
                    className="h-9 text-xs rounded-lg border-amber-300 text-amber-900 hover:bg-amber-50 cursor-pointer font-semibold"
                  >
                    Báo Khách đang ngồi
                  </Button>
                  <Button
                    onClick={() => handleSetTableStatus(activeTableDetail.id, 'reserved')}
                    variant="outline"
                    className="h-9 text-xs rounded-lg border-sky-300 text-sky-900 hover:bg-sky-50 cursor-pointer font-semibold"
                  >
                    Ghi nhận Đã đặt trước
                  </Button>
                  <Button
                    onClick={() => handleSetTableStatus(activeTableDetail.id, 'cleaning')}
                    variant="outline"
                    className="h-9 text-xs rounded-lg border-stone-300 text-stone-700 hover:bg-stone-100 cursor-pointer font-semibold"
                  >
                    Chuyển sang Đang dọn
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 border-t border-stone-200/50 pt-3">
              <Button
                variant="ghost"
                onClick={() => setActiveTableDetail(null)}
                className="h-9 text-xs rounded-lg text-stone-500 cursor-pointer"
              >
                Đóng
              </Button>
              <Link
                href="/admin/pos"
                className="h-9 text-xs rounded-lg bg-[#5A3E2B] text-white hover:bg-[#684732] font-semibold px-4 flex items-center justify-center transition-colors cursor-pointer"
              >
                Mở POS ghi order bàn này
              </Link>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 4. Shift Close & Print Modal */}
      {isShiftModalOpen && (
        <Dialog open={isShiftModalOpen} onOpenChange={setIsShiftModalOpen}>
          <DialogContent className="max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-lg font-bold text-stone-900">
                Chốt ca làm việc & In báo cáo Z-Report <DemoNotice compact />
              </DialogTitle>
              <DialogDescription className="text-xs text-stone-500">
                Ca sáng: 06:30 - 14:30 · Quản lý: Nguyễn Hoàng Nam
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="p-3.5 rounded-lg bg-stone-50 space-y-2 border border-stone-200/60">
                <div className="flex justify-between">
                  <span className="text-stone-600">Tổng doanh thu ca:</span>
                  <strong className="text-stone-900 font-bold tabular-nums">775.000 đ</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Tổng số đơn phục vụ:</span>
                  <strong className="text-stone-900 font-bold tabular-nums">28 đơn</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Tiền mặt tại két:</span>
                  <strong className="text-stone-900 font-bold tabular-nums">348.750 đ</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Chuyển khoản & Thẻ POS:</span>
                  <strong className="text-stone-900 font-bold tabular-nums">426.250 đ</strong>
                </div>
              </div>

              <p className="text-[11px] text-stone-500 italic">
                * Sau khi nhấn xác nhận, hệ thống sẽ chốt sổ ca sáng, đồng bộ kho nguyên liệu và kích hoạt lệnh in phiếu Z-Report tại máy in quầy thu ngân.
              </p>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 border-t border-stone-200/50 pt-3">
              <Button
                variant="ghost"
                onClick={() => setIsShiftModalOpen(false)}
                className="h-9 text-xs rounded-lg text-stone-500 cursor-pointer"
              >
                Hủy
              </Button>
              <Button
                onClick={() => {
                  setIsShiftModalOpen(false)
                  toast.success('Đã hoàn tất chốt ca sáng! Báo cáo Z-Report #SHIFT-041 đã gửi tới máy in nhiệt quầy thu ngân.')
                }}
                className="h-9 text-xs rounded-lg bg-[#5A3E2B] text-white hover:bg-[#684732] font-semibold cursor-pointer gap-1.5 px-4"
              >
                <Printer className="size-3.5" />
                <span>Xác nhận & In báo cáo</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default DashboardOperationalView
