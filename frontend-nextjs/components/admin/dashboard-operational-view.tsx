'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ReservationView } from '@/lib/admin/queries'
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
import { formatOrderTables } from '@/lib/admin/order-display'
import { formatCurrency, formatElapsed, tableStatusLabels } from '@/lib/admin/format'
import type { FloorTable, MenuItem, Order, OrderStatus, TableStatus } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import { DEFAULT_BRANCH_ID } from '@/lib/branches'

// Default fallback data if server props are undefined
const defaultTables: FloorTable[] = ([
  { id: 12, name: 'Bar 01', seats: 1, zone: 'Quầy Bar', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80' },
  { id: 13, name: 'Bar 02', seats: 1, zone: 'Quầy Bar', status: 'occupied', guestCount: 1, occupiedSince: new Date(Date.now() - 15 * 60000), updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1445116572660-238429888876?auto=format&fit=crop&w=800&q=80' },
  { id: 14, name: 'Bar 03', seats: 1, zone: 'Quầy Bar', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=800&q=80' },
  { id: 15, name: 'Bar 04', seats: 1, zone: 'Quầy Bar', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80' },
  { id: 1, name: 'Bàn 01', seats: 2, zone: 'Phòng lạnh', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80' },
  { id: 2, name: 'Bàn 02', seats: 4, zone: 'Phòng lạnh', status: 'occupied', guestCount: 3, occupiedSince: new Date(Date.now() - 35 * 60000), updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=800&q=80' },
  { id: 3, name: 'Bàn 03', seats: 4, zone: 'Phòng lạnh', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=800&q=80' },
  { id: 4, name: 'Bàn 04', seats: 2, zone: 'Phòng lạnh', status: 'reserved', guestCount: 2, occupiedSince: null, updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=800&q=80' },
  { id: 5, name: 'Bàn 05', seats: 6, zone: 'Phòng lạnh', status: 'occupied', guestCount: 5, occupiedSince: new Date(Date.now() - 75 * 60000), updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?auto=format&fit=crop&w=800&q=80' },
  { id: 6, name: 'Bàn 06', seats: 4, zone: 'Phòng lạnh', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=800&q=80' },
  { id: 7, name: 'Vườn 01', seats: 4, zone: 'Sân vườn', status: 'occupied', guestCount: 4, occupiedSince: new Date(Date.now() - 50 * 60000), updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80' },
  { id: 8, name: 'Vườn 02', seats: 2, zone: 'Sân vườn', status: 'cleaning', guestCount: 0, occupiedSince: null, updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1525610553991-2bede1a236e2?auto=format&fit=crop&w=800&q=80' },
  { id: 9, name: 'Vườn 03', seats: 4, zone: 'Sân vườn', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80' },
  { id: 10, name: 'Vườn 04', seats: 2, zone: 'Sân vườn', status: 'available', guestCount: 0, occupiedSince: null, updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1508766917616-d22f3f1eea14?auto=format&fit=crop&w=800&q=80' },
  { id: 11, name: 'Vườn 05', seats: 2, zone: 'Sân vườn', status: 'reserved', guestCount: 2, occupiedSince: null, updatedAt: new Date(), imageUrl: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80' },
] as Omit<FloorTable, 'branch'>[]).map((table) => ({ ...table, branch: DEFAULT_BRANCH_ID }))

const defaultOrders: Order[] = ([
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
] as Omit<Order, 'branch'>[]).map((order) => ({ ...order, branch: DEFAULT_BRANCH_ID }))

export interface DashboardOperationalViewProps {
  initialTables?: FloorTable[]
  initialOrders?: Order[]
  overview?: any
  menuItems?: MenuItem[]
  reportOrders?: Order[]
  reservations?: ReservationView[]
}

export function DashboardOperationalView({
  initialTables,
  initialOrders,
  menuItems = [],
  reportOrders = [],
  reservations = [],
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

  const router = useRouter()
  useEffect(() => {
    if (initialTables) setTables(initialTables.map(t => ({ ...t, zone: t.zone === 'Coffee Bar' ? 'Quầy Bar' : t.zone === 'Main Floor' ? 'Phòng lạnh' : t.zone === 'Patio' ? 'Sân vườn' : t.zone })))
  }, [initialTables])
  useEffect(() => { if (initialOrders) setOrders(initialOrders) }, [initialOrders])
  const paidOrders = reportOrders.filter(order => order.paymentStatus === 'paid')
  const reportTotal = paidOrders.reduce((sum, order) => sum + order.total, 0)
  const cashTotal = paidOrders.filter(order => order.paymentMethod === 'cash').reduce((sum, order) => sum + order.total, 0)
  const offSale = menuItems.filter(item => item.kind === 'menu' && !item.inStock)
  const sold = new Map<string, number>()
  for (const order of paidOrders) for (const item of order.items) sold.set(item.name, (sold.get(item.name) ?? 0) + item.qty)
  const bestSellers = [...sold].sort((a, b) => b[1] - a[1]).slice(0, 4)
  const pendingReservations = reservations.filter(r => r.status === 'Chờ xác nhận' || r.status === 'Đã đặt').slice(0, 4)
  const money = (value: number) => `${Math.round(value).toLocaleString('vi-VN')} đ`

  // Compute live operational metrics
  const activeOrdersCount = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length
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
      const res = await updateOrderStatus(orderId, nextStatus)
      if (res.ok) {
        setOrders(prev => prev.map(order => order.id === orderId ? { ...order, status: nextStatus } : order))
        router.refresh()
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
      const table = tables.find(t => t.id === tableId)
      const guests = newStatus === 'occupied' ? Math.min(table?.seats ?? 1, table?.guestCount || 2) : 0
      const res = await updateTableStatus(tableId, newStatus, guests)
      if (!res.ok) { toast.error(res.error || 'Không thể đổi trạng thái bàn'); return }
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? {
                ...t,
                status: newStatus,
                occupiedSince: newStatus === 'occupied' ? (t.occupiedSince ?? new Date()) : null,
                guestCount: guests,
              }
            : t
        )
      )
      setActiveTableDetail(null)
      router.refresh()
      toast.success(`Đã cập nhật trạng thái bàn sang "${tableStatusLabels[newStatus]}"`)
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
              {new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              {brewingOrdersCount} đơn đang pha chế · {overdueTablesCount} bàn quá giờ
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-stone-500 pt-0.5">
            <span>Tổng quan vận hành</span>
            <span className="text-stone-300">·</span>
            <span>Dữ liệu từ đơn hàng, kho và đặt bàn</span>
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
            href="/admin/menu"
            className="h-10 rounded-lg bg-white text-stone-800 shadow-2xs hover:bg-stone-50 border border-stone-200/80 font-semibold text-xs gap-1.5 px-3.5 flex items-center justify-center transition-colors"
          >
            <Package className="size-3.5 text-[#5A3E2B]" />
            <span>Thực đơn</span>
          </Link>

          <Button
            onClick={() => setIsShiftModalOpen(true)}
            className="h-10 rounded-lg bg-[#5A3E2B] text-white hover:bg-[#684732] shadow-xs font-semibold text-xs gap-1.5 px-4 cursor-pointer"
          >
            <Printer className="size-3.5" />
            <span>In báo cáo doanh thu</span>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
                  ? orders.find((o) => (o.tableIds?.length ? o.tableIds : [o.tableId]).includes(table.id) && o.status !== 'completed' && o.status !== 'cancelled')
                  : null

                return (
                  <div
                    key={table.id}
                    onClick={() => setActiveTableDetail(table)}
                    className={cn(
                      'group isolate overflow-hidden min-h-[140px] rounded-lg p-3 text-left transition-all cursor-pointer relative',
                      'shadow-2xs hover:shadow-md hover:-translate-y-0.5',
                      isOccupied && !isOverdue && 'bg-amber-500/10 ring-1 ring-amber-300/60',
                      isOverdue && 'bg-rose-50 ring-1 ring-rose-300/80',
                      isReserved && 'bg-sky-50/80 ring-1 ring-sky-200/80',
                      isCleaning && 'bg-stone-100/90 text-stone-600',
                      table.status === 'available' && 'bg-emerald-50/70 hover:bg-emerald-50/90'
                    )}
                  >
                    {table.imageUrl && (
                      <>
                        <img
                          src={table.imageUrl}
                          alt=""
                          className="absolute inset-0 -z-20 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-white/95 via-white/85 to-white/70 backdrop-blur-[0.5px]" />
                      </>
                    )}
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
                    Hàng đợi pha chế
                  </h3>
                  <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-amber-100 font-bold text-amber-950 tabular-nums whitespace-nowrap shrink-0">
                    {orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length} vé đang xử lý
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  Cập nhật liên tục từ quầy thu ngân và khách gọi món tại bàn.
                </p>
              </div>

              <Link
                href="/admin/pos?tab=kitchen"
                className="h-8 text-xs font-semibold text-[#5A3E2B] hover:text-[#684732] hover:bg-stone-100 px-3 inline-flex items-center gap-1.5 rounded-lg border border-stone-200/60 shadow-2xs transition-colors whitespace-nowrap shrink-0 self-start lg:self-center"
              >
                <span>Màn hình pha chế đầy đủ</span>
                <ArrowRight className="size-3.5 shrink-0" />
              </Link>
            </div>

            {/* Tickets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {orders
                .filter((o) => o.status !== 'completed' && o.status !== 'cancelled')
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
                            {elapsedMinutes} phút trước
                          </span>
                        </div>

                        {/* Customer / Location Tag */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-stone-800 truncate max-w-[140px]">
                            {order.customer === 'Walk-in' ? 'Khách vãng lai' : order.customer}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white text-stone-700 shadow-2xs border border-stone-200/60">
                            {formatOrderTables(order, tables)}
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
          <section className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
            <h4 className="font-bold text-stone-700">Doanh thu 7 ngày gần nhất</h4>
            <p className="text-2xl font-black">{money(reportTotal)}</p>
            <p className="text-sm text-stone-500">{paidOrders.length} đơn đã thanh toán</p>
            <p className="text-xs text-stone-500">Tiền mặt: {money(cashTotal)} · QR / thẻ: {money(reportTotal - cashTotal)}</p>
            <Link href="/admin/analytics" className="text-sm font-semibold text-[#5A3E2B] underline">Xem báo cáo chi tiết</Link>
          </section>
          <section className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
            <h4 className="font-bold text-stone-700">Món tạm ngưng bán · {offSale.length} món</h4>
            {offSale.length === 0 ? <p className="text-sm text-stone-500">Tất cả món đang được bán.</p> : offSale.slice(0, 4).map(item => <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><strong>{item.name}</strong><p>{item.category} · đang tắt bán</p></div>)}
            <Link href="/admin/menu" className="text-sm font-semibold text-[#5A3E2B] underline">Bật, tắt món trong thực đơn</Link>
          </section>
          <section className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
            <h4 className="font-bold text-stone-700">Món bán chạy · 7 ngày</h4>
            {bestSellers.length === 0 ? <p className="text-sm text-stone-500">Chưa có đơn đã thanh toán.</p> : bestSellers.map(([name, quantity]) => <p key={name} className="flex justify-between gap-2 text-sm"><span>{name}</span><strong>{quantity} phần</strong></p>)}
          </section>
          <section className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
            <h4 className="font-bold text-stone-700">Phiếu đặt bàn đang chờ</h4>
            {pendingReservations.length === 0 ? <p className="text-sm text-stone-500">Không có phiếu đang chờ.</p> : pendingReservations.map(reservation => <div key={`${reservation.source}-${reservation.id}`} className="rounded-lg border border-stone-200 p-3 text-sm"><strong>{reservation.customer} · {reservation.guests} khách</strong><p>{reservation.dateTime} · {reservation.table}</p></div>)}
            <Link href="/admin/reservations" className="text-sm font-semibold text-[#5A3E2B] underline">Quản lý và đón khách</Link>
          </section>
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

            {activeTableDetail.imageUrl && (
              <div className="relative h-44 w-full overflow-hidden rounded-xl border border-stone-200 mt-2 shadow-2xs">
                <img
                  src={activeTableDetail.imageUrl}
                  alt={activeTableDetail.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
                  <span className="text-xs font-bold drop-shadow-sm">Không gian {activeTableDetail.zone}</span>
                  <span className="text-[11px] font-semibold bg-white/20 backdrop-blur-md px-2 py-0.5 rounded">
                    Sức chứa {activeTableDetail.seats} chỗ
                  </span>
                </div>
              </div>
            )}

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
                Báo cáo doanh thu 7 ngày
              </DialogTitle>
              <DialogDescription className="text-xs text-stone-500">
                Tổng hợp các đơn đã thanh toán trong 7 ngày gần nhất.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="p-3.5 rounded-lg bg-stone-50 space-y-2 border border-stone-200/60">
                <div className="flex justify-between">
                  <span className="text-stone-600">Tổng doanh thu:</span>
                  <strong className="text-stone-900 font-bold tabular-nums">{money(reportTotal)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Số đơn đã thanh toán:</span>
                  <strong className="text-stone-900 font-bold tabular-nums">{paidOrders.length} đơn</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Doanh thu tiền mặt:</span>
                  <strong className="text-stone-900 font-bold tabular-nums">{money(cashTotal)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Chuyển khoản & Thẻ POS:</span>
                  <strong className="text-stone-900 font-bold tabular-nums">{money(reportTotal - cashTotal)}</strong>
                </div>
              </div>

              <p className="text-[11px] text-stone-500 italic">
                Mở hộp thoại in của trình duyệt. Báo cáo này không chốt sổ ca hoặc tự thay đổi số liệu kho.
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
                  window.print()
                }}
                className="h-9 text-xs rounded-lg bg-[#5A3E2B] text-white hover:bg-[#684732] font-semibold cursor-pointer gap-1.5 px-4"
              >
                <Printer className="size-3.5" />
                <span>In báo cáo</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default DashboardOperationalView
