'use client'

import { useMemo, useState } from 'react'
import {
  Armchair,
  CheckCircle2,
  Clock,
  Coffee,
  CreditCard,
  Download,
  Eye,
  Filter,
  Package,
  Printer,
  QrCode,
  Receipt,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingBag,
  TrendingUp,
  Truck,
  User,
  X,
} from 'lucide-react'
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
import type { OrderHistoryItem } from '@/lib/admin/queries'
import type { OrderStatus, PaymentMethod, OrderType } from '@/lib/db/schema'
import { cn } from '@/lib/utils'

const formatVnd = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

const time = (value: Date | string | null | undefined) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const shortTime = (value: Date | string | null | undefined) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
}

const channelLabels: Record<OrderType, { label: string; icon: any; color: string }> = {
  'dine-in': { label: 'Tại bàn / Quầy', icon: Armchair, color: 'bg-amber-50 text-amber-900 border-amber-300' },
  delivery: { label: 'Giao hàng', icon: Truck, color: 'bg-blue-50 text-blue-900 border-blue-300' },
  pickup: { label: 'Tự đến lấy', icon: ShoppingBag, color: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
}

const paymentMethodLabels: Record<PaymentMethod, { label: string; icon: any; color: string }> = {
  cash: { label: 'Tiền mặt', icon: Receipt, color: 'bg-stone-100 text-stone-800 border-stone-300' },
  qr: { label: 'VietQR', icon: QrCode, color: 'bg-cyan-50 text-cyan-900 border-cyan-300' },
  card: { label: 'Thẻ / POS', icon: CreditCard, color: 'bg-indigo-50 text-indigo-900 border-indigo-300' },
}

const statusLabels: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: 'Chờ xử lý', color: 'bg-amber-100/80 text-amber-950 border-amber-300' },
  brewing: { label: 'Đang pha chế', color: 'bg-purple-100/80 text-purple-950 border-purple-300' },
  ready: { label: 'Sẵn sàng / Đang giao', color: 'bg-blue-100/80 text-blue-950 border-blue-300' },
  completed: { label: 'Hoàn thành', color: 'bg-emerald-100/80 text-emerald-900 border-emerald-300' },
  cancelled: { label: 'Đã hủy', color: 'bg-rose-100 text-rose-900 border-rose-300' },
}

export function OrderHistory({ orders }: { orders: OrderHistoryItem[] }) {
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState<'all' | OrderType>('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'refunded'>('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | PaymentMethod>('all')
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount_desc'>('newest')
  const [selectedOrder, setSelectedOrder] = useState<OrderHistoryItem | null>(null)

  // Tính toán cho phần tóm tắt KPI
  const stats = useMemo(() => {
    const totalOrders = orders.length
    const paidOrders = orders.filter((o) => o.paymentStatus === 'paid')
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0)

    const dineInOrders = orders.filter((o) => o.orderType === 'dine-in')
    const dineInRevenue = dineInOrders.filter((o) => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.total, 0)

    const onlineOrders = orders.filter((o) => o.orderType === 'delivery' || o.orderType === 'pickup')
    const onlineRevenue = onlineOrders.filter((o) => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.total, 0)

    return {
      totalOrders,
      totalRevenue,
      dineInCount: dineInOrders.length,
      dineInRevenue,
      onlineCount: onlineOrders.length,
      onlineRevenue,
    }
  }, [orders])

  // Lọc và sắp xếp
  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase()
    const cleanPhoneQuery = query.replace(/\D/g, '')

    return orders
      .filter((order) => {
        if (channelFilter !== 'all' && order.orderType !== channelFilter) return false
        if (paymentStatusFilter !== 'all' && order.paymentStatus !== paymentStatusFilter) return false
        if (paymentMethodFilter !== 'all' && order.paymentMethod !== paymentMethodFilter) return false
        if (orderStatusFilter !== 'all' && order.status !== orderStatusFilter) return false

        if (query) {
          const matchCode = order.orderCode.toLowerCase().includes(query)
          const matchCustomer = order.customer.toLowerCase().includes(query)
          const matchTable = order.tableName?.toLowerCase().includes(query)
          const matchPhone = order.contact?.phone ? order.contact.phone.includes(cleanPhoneQuery || query) : false
          const matchAddress = order.contact?.address?.toLowerCase().includes(query)
          const matchItem = order.items.some((i) => i.name.toLowerCase().includes(query))
          if (!matchCode && !matchCustomer && !matchTable && !matchPhone && !matchAddress && !matchItem) {
            return false
          }
        }
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        if (sortBy === 'amount_desc') return b.total - a.total
        return 0
      })
  }, [orders, search, channelFilter, paymentStatusFilter, paymentMethodFilter, orderStatusFilter, sortBy])

  function resetFilters() {
    setSearch('')
    setChannelFilter('all')
    setPaymentStatusFilter('all')
    setPaymentMethodFilter('all')
    setOrderStatusFilter('all')
    setSortBy('newest')
  }

  const isFiltered =
    search !== '' ||
    channelFilter !== 'all' ||
    paymentStatusFilter !== 'all' ||
    paymentMethodFilter !== 'all' ||
    orderStatusFilter !== 'all' ||
    sortBy !== 'newest'

  return (
    <div className="space-y-6 font-sans text-stone-900">
      {/* 4 thẻ thống kê nhanh */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 lg:gap-4">
        {/* Card 1: Tổng đơn hàng */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">TỔNG ĐƠN HÀNG</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-stone-100 text-[#5A3E2B]">
              <ReceiptText className="size-4.5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-stone-900">
            {stats.totalOrders} <span className="text-sm font-medium text-stone-500">đơn</span>
          </div>
          <p className="mt-1 text-[11px] text-stone-500">Toàn bộ giao dịch đã ghi nhận</p>
        </div>

        {/* Card 2: Doanh thu thực thu */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">DOANH THU ĐÃ THU</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <TrendingUp className="size-4.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold tracking-tight text-emerald-700 sm:text-2xl">
            {formatVnd(stats.totalRevenue)}
          </div>
          <p className="mt-1 text-[11px] text-stone-500">Từ các đơn đã thanh toán</p>
        </div>

        {/* Card 3: Tại quầy & Bàn */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">TẠI QUẦY / BÀN ĂN</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-900">
              <Armchair className="size-4.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">
            {stats.dineInCount} <span className="text-xs font-medium text-stone-500">đơn</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-800 font-semibold">{formatVnd(stats.dineInRevenue)}</p>
        </div>

        {/* Card 4: Đơn Online */}
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">ĐƠN ĐẶT ONLINE</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-100 text-blue-900">
              <Truck className="size-4.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">
            {stats.onlineCount} <span className="text-xs font-medium text-stone-500">đơn</span>
          </div>
          <p className="mt-1 text-[11px] text-blue-800 font-semibold">{formatVnd(stats.onlineRevenue)}</p>
        </div>
      </div>

      {/* Khung lọc và thao tác chính */}
      <div className="space-y-4 rounded-xl border border-stone-200/90 bg-white p-4 sm:p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
        {/* Ô tìm kiếm phía trên và bộ lọc nhanh theo kênh */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 max-w-lg">
            <Search className="pointer-events-none absolute left-3.5 top-3 size-4 text-stone-400" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã đơn (#AC-...), tên khách, SĐT, bàn, tên món..."
              aria-label="Tìm kiếm lịch sử đơn hàng"
              className="h-10 w-full truncate rounded-lg border border-stone-200/90 bg-stone-50/50 pl-10 pr-4 text-xs text-stone-900 placeholder:text-stone-400 focus:border-[#5A3E2B] focus:bg-white focus:outline-none md:text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Các tab kênh bán nhanh */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-stone-200/80 bg-stone-100/80 p-1">
            {[
              { id: 'all', label: 'Tất cả kênh' },
              { id: 'dine-in', label: 'Tại bàn / POS' },
              { id: 'delivery', label: 'Giao hàng' },
              { id: 'pickup', label: 'Mang đi' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setChannelFilter(tab.id as any)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer',
                  channelFilter === tab.id
                    ? 'bg-white text-[#5A3E2B] shadow-xs'
                    : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bộ lọc phụ chi tiết */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 text-xs">
          {/* Thanh toán */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500 font-medium">Thanh toán:</span>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-800 font-medium focus:border-[#5A3E2B] focus:outline-none"
            >
              <option value="all">Mọi trạng thái</option>
              <option value="paid">Đã thanh toán</option>
              <option value="unpaid">Chưa thanh toán</option>
              <option value="refunded">Đã ghi nhận hoàn tiền</option>
            </select>
          </div>

          {/* Phương thức */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500 font-medium">Hình thức:</span>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-800 font-medium focus:border-[#5A3E2B] focus:outline-none"
            >
              <option value="all">Mọi hình thức</option>
              <option value="cash">Tiền mặt</option>
              <option value="qr">VietQR</option>
              <option value="card">Thẻ ngân hàng</option>
            </select>
          </div>

          {/* Chế biến */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500 font-medium">Tiến độ:</span>
            <select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value as any)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-800 font-medium focus:border-[#5A3E2B] focus:outline-none"
            >
              <option value="all">Mọi tiến độ</option>
              <option value="completed">Hoàn thành</option>
              <option value="ready">Sẵn sàng / Đang giao</option>
              <option value="brewing">Đang pha chế</option>
              <option value="pending">Chờ xử lý</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>

          {/* Sắp xếp */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-stone-500 font-medium">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-800 font-medium focus:border-[#5A3E2B] focus:outline-none"
            >
              <option value="newest">Mới nhất trước</option>
              <option value="oldest">Cũ nhất trước</option>
              <option value="amount_desc">Giá trị lớn nhất</option>
            </select>
          </div>

          {isFiltered && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs text-[#B45309] font-medium hover:underline ml-2 cursor-pointer"
            >
              <RotateCcw className="size-3" />
              Đặt lại
            </button>
          )}
        </div>
      </div>

      {/* Danh sách / bảng đơn hàng */}
      <div className="rounded-xl border border-stone-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
              <ReceiptText className="size-6" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-stone-900">Không tìm thấy đơn hàng nào</h3>
            <p className="mt-1 text-xs text-stone-500">
              {isFiltered ? 'Hãy thử điều chỉnh hoặc xóa bộ lọc tìm kiếm.' : 'Chưa có dữ liệu giao dịch nào được lưu.'}
            </p>
            {isFiltered && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="mt-4 border-stone-300 text-stone-700 hover:bg-stone-50"
              >
                Xóa tất cả bộ lọc
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-800">
              <thead className="border-b border-stone-200 bg-stone-50/70 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Mã đơn & Thời gian</th>
                  <th className="px-4 py-3">Kênh & Vị trí</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Món & Số lượng</th>
                  <th className="px-4 py-3 text-right">Tổng tiền & Thanh toán</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredOrders.map((order) => {
                  const channel = channelLabels[order.orderType] ?? channelLabels['dine-in']
                  const ChannelIcon = channel.icon
                  const payMethod = paymentMethodLabels[order.paymentMethod] ?? paymentMethodLabels.cash
                  const PayMethodIcon = payMethod.icon
                  const statusInfo = statusLabels[order.status] ?? statusLabels.completed

                  const itemCount = order.items.reduce((sum, i) => sum + i.qty, 0)

                  return (
                    <tr
                      key={order.id}
                      className="group transition-colors hover:bg-stone-50/60 cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      {/* Mã đơn & Thời gian */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-stone-900 group-hover:text-[#5A3E2B]">
                          #{order.orderCode}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-stone-400 mt-0.5">
                          <Clock className="size-3 shrink-0" />
                          <span>{shortTime(order.createdAt)}</span>
                        </div>
                      </td>

                      {/* Kênh & Vị trí */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border',
                              channel.color,
                            )}
                          >
                            <ChannelIcon className="size-3" />
                            {channel.label}
                          </span>
                          {order.tableName && (
                            <span className="text-[11px] font-semibold text-stone-700">
                              {order.tableName}
                            </span>
                          )}
                          {order.orderType === 'delivery' && order.contact?.address && (
                            <span className="text-[10px] text-stone-400 max-w-[160px] truncate" title={order.contact.address}>
                              {order.contact.address}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Khách hàng */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-stone-900">{order.customer || 'Khách vãng lai'}</div>
                        {order.contact?.phone && (
                          <div className="text-[11px] text-stone-500 font-mono">{order.contact.phone}</div>
                        )}
                      </td>

                      {/* Món & Số lượng */}
                      <td className="px-4 py-3.5">
                        <div className="max-w-xs">
                          <div className="text-stone-800 truncate font-medium">
                            {order.items.map((i) => `${i.name} (x${i.qty})`).join(', ')}
                          </div>
                          <div className="text-[11px] text-stone-400 mt-0.5">
                            {itemCount} sản phẩm
                          </div>
                        </div>
                      </td>

                      {/* Tổng tiền & Thanh toán */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="text-sm font-extrabold text-stone-900">
                          {formatVnd(order.total)}
                        </div>
                        <div className="flex items-center justify-end gap-1.5 mt-1">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                              payMethod.color,
                            )}
                          >
                            <PayMethodIcon className="size-2.5" />
                            {payMethod.label}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-bold px-1.5 py-0.5 rounded border',
                              order.paymentStatus === 'paid'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200',
                            )}
                          >
                            {order.paymentStatus === 'refunded' ? 'Đã ghi nhận hoàn tiền' : order.paymentStatus === 'paid' ? 'Đã thu' : 'Chưa thu'}
                          </span>
                        </div>
                      </td>

                      {/* Trạng thái tiến độ */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-tight',
                            statusInfo.color,
                          )}
                        >
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Chi tiết */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedOrder(order)
                          }}
                          className="size-8 text-stone-500 hover:text-[#5A3E2B] hover:bg-stone-100"
                          title="Xem hóa đơn chi tiết"
                        >
                          <Eye className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Thanh tóm tắt ở chân */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-stone-200 bg-stone-50/50 px-4 py-3 text-xs text-stone-500 gap-2">
          <div>
            Hiển thị <span className="font-bold text-stone-800">{filteredOrders.length}</span> trên tổng số{' '}
            <span className="font-bold text-stone-800">{orders.length}</span> đơn hàng
          </div>
          <div className="font-medium text-stone-600">
            Tổng giá trị trang này:{' '}
            <span className="font-bold text-[#5A3E2B]">
              {formatVnd(filteredOrders.reduce((sum, o) => sum + o.total, 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Hộp thoại chi tiết đơn / hóa đơn */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-lg p-0 font-sans overflow-hidden bg-white rounded-2xl border border-stone-200/90 shadow-2xl">
          {selectedOrder && (
            <div>
              {/* Phần đầu hóa đơn */}
              <div className="border-b border-dashed border-stone-300 bg-stone-50/80 p-5 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-[#5A3E2B] text-amber-300 shadow-xs mb-2">
                  <Coffee className="size-5" />
                </div>
                <h3 className="text-base font-extrabold tracking-tight text-stone-900">
                  ĐÀ LẠT CAFE
                </h3>
                <p className="text-[11px] text-stone-500">
                  {selectedOrder.branch === 'bui-thi-xuan'
                    ? '456 Bùi Thị Xuân, Phường Xuân Hương, Đà Lạt'
                    : '123 Phan Đình Phùng, Phường Xuân Hương, Đà Lạt'}
                </p>
                <div className="mt-3 inline-block rounded-md bg-stone-200/70 px-3 py-1 font-mono text-xs font-bold text-stone-800">
                  HÓA ĐƠN #{selectedOrder.orderCode}
                </div>
                <p className="mt-1 text-[11px] text-stone-400">
                  Thời gian: {time(selectedOrder.createdAt)}
                </p>
              </div>

              {/* Thông tin ngữ cảnh của đơn */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs border-b border-stone-100 pb-3">
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-bold tracking-wider">
                      Khách hàng
                    </span>
                    <span className="font-semibold text-stone-900">
                      {selectedOrder.customer || 'Khách vãng lai'}
                    </span>
                    {selectedOrder.contact?.phone && (
                      <span className="block text-stone-500 font-mono text-[11px]">
                        {selectedOrder.contact.phone}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-bold tracking-wider">
                      Hình thức & Vị trí
                    </span>
                    <span className="font-semibold text-stone-900">
                      {channelLabels[selectedOrder.orderType]?.label}
                    </span>
                    {selectedOrder.tableName && (
                      <span className="block text-amber-900 font-medium text-[11px]">
                        {selectedOrder.tableName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Thông tin giao hàng nếu có */}
                {selectedOrder.orderType === 'delivery' && selectedOrder.contact?.address && (
                  <div className="rounded-lg bg-blue-50/70 border border-blue-100 p-2.5 text-xs text-blue-900">
                    <span className="font-bold block text-[10px] uppercase tracking-wider text-blue-700">
                      Địa chỉ nhận hàng:
                    </span>
                    <span className="text-[11px] font-medium">{selectedOrder.contact.address}</span>
                    {selectedOrder.contact.note && (
                      <p className="mt-1 text-[10px] italic text-blue-600">
                        Ghi chú: {selectedOrder.contact.note}
                      </p>
                    )}
                  </div>
                )}

                {/* Bảng các món */}
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-bold tracking-wider mb-2">
                    Danh sách sản phẩm
                  </span>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedOrder.items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-stone-50"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="font-semibold text-stone-900 truncate">{item.name}</div>
                          {item.variation && (
                            <div className="text-[10px] text-stone-400">{item.variation}</div>
                          )}
                        </div>
                        <div className="text-stone-500 text-right font-mono px-2">
                          x{item.qty}
                        </div>
                        <div className="text-right font-semibold text-stone-800 whitespace-nowrap">
                          {formatVnd(item.price * item.qty)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tóm tắt tài chính */}
                <div className="border-t border-dashed border-stone-300 pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-stone-500">
                    <span>Tạm tính</span>
                    <span>{formatVnd(selectedOrder.subtotal || selectedOrder.total)}</span>
                  </div>
                  {selectedOrder.subtotal > selectedOrder.total && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Giảm giá / Ưu đãi</span>
                      <span>-{formatVnd(selectedOrder.subtotal - selectedOrder.total)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-stone-900 pt-1.5 border-t border-stone-100">
                    <span>TỔNG THANH TOÁN</span>
                    <span className="text-[#5A3E2B]">{formatVnd(selectedOrder.total)}</span>
                  </div>
                </div>

                {/* Thông tin thanh toán */}
                <div className="rounded-lg bg-stone-50 p-2.5 text-xs space-y-1 border border-stone-100">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Phương thức:</span>
                    <span className="font-semibold text-stone-800">
                      {paymentMethodLabels[selectedOrder.paymentMethod]?.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Trạng thái thanh toán:</span>
                    <span
                      className={cn(
                        'font-bold text-[11px]',
                        selectedOrder.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700',
                      )}
                    >
                      {selectedOrder.paymentStatus === 'refunded' ? 'Đã ghi nhận hoàn tiền' : selectedOrder.paymentStatus === 'paid' ? 'Đã thanh toán đủ' : 'Chưa thu tiền'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Trạng thái món:</span>
                    <span className="font-semibold text-stone-800">
                      {statusLabels[selectedOrder.status]?.label}
                    </span>
                  </div>
                  {selectedOrder.completedAt && (
                    <div className="flex justify-between text-[11px] text-stone-400 pt-0.5">
                      <span>Hoàn tất lúc:</span>
                      <span>{time(selectedOrder.completedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Các thao tác ở chân hộp thoại */}
              <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50/80 px-5 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="gap-1.5 text-xs border-stone-300 text-stone-700 hover:bg-white"
                >
                  <Printer className="size-3.5" />
                  In hóa đơn
                </Button>
                <Button
                  size="sm"
                  onClick={() => setSelectedOrder(null)}
                  className="text-xs bg-[#5A3E2B] text-white hover:bg-[#684732]"
                >
                  Đóng
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

