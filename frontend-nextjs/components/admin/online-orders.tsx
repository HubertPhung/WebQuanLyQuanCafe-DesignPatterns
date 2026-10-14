'use client'

import { useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  Globe,
  MapPin,
  Package,
  Phone,
  RotateCcw,
  Search,
  Truck,
  User,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export type OnlineOrderStatus = 'Chờ xác nhận' | 'Đang chuẩn bị' | 'Đang giao' | 'Hoàn thành' | 'Đã hủy'

interface OnlineOrderItem {
  name: string
  options: string
  qty: number
  price: number
}

interface OnlineOrder {
  id: string
  orderCode: string
  customer: string
  phone: string
  address: string
  type: 'Giao hàng' | 'Tự lấy'
  status: OnlineOrderStatus
  pointsUsed: number
  shippingFee: number
  subtotal: number
  total: number
  createdAt: string
  items: OnlineOrderItem[]
}

const initialOrders: OnlineOrder[] = [
  {
    id: '27',
    orderCode: '#27',
    customer: 'Phùng Hoài Bo',
    phone: '0908 123 456',
    address: '123 Đường Nguyễn Huệ, P. Bến Nghé, Q.1, TP. Hồ Chí Minh',
    type: 'Giao hàng',
    status: 'Chờ xác nhận',
    pointsUsed: 20,
    shippingFee: 15000,
    subtotal: 130000,
    total: 125000,
    createdAt: 'Hôm nay · 14:15',
    items: [
      { name: 'Cà phê Latte Vani Mịn', options: 'Sữa tươi thanh trùng · Ít ngọt', qty: 2, price: 55000 },
      { name: 'Bánh Croissant bơ Pháp', options: 'Nướng nóng giòn', qty: 1, price: 45000 },
    ],
  },
  {
    id: '26',
    orderCode: '#26',
    customer: 'Nguyễn Thị Lan',
    phone: '0911 223 344',
    address: 'Nhận tại quầy chi nhánh Trung tâm',
    type: 'Tự lấy',
    status: 'Đang chuẩn bị',
    pointsUsed: 0,
    shippingFee: 0,
    subtotal: 95000,
    total: 95000,
    createdAt: 'Hôm nay · 13:50',
    items: [
      { name: 'Cold Brew Cam Vàng', options: 'Ủ lạnh nguyên bản', qty: 1, price: 55000 },
      { name: 'Bánh mì thịt xông khói giòn', options: 'Nhiều dưa leo', qty: 1, price: 40000 },
    ],
  },
  {
    id: '25',
    orderCode: '#25',
    customer: 'Lê Hoàng Hải',
    phone: '0978 999 888',
    address: 'Tòa nhà Bitexco, 2 Hải Triều, Q.1, TP. Hồ Chí Minh',
    type: 'Giao hàng',
    status: 'Đang giao',
    pointsUsed: 10,
    shippingFee: 15000,
    subtotal: 155000,
    total: 160000,
    createdAt: 'Hôm nay · 12:30',
    items: [
      { name: 'Cà phê Muối Đặc Biệt', options: 'Đá riêng', qty: 2, price: 45000 },
      { name: 'Cơm chiên hoàng bào', options: 'Không cay', qty: 1, price: 65000 },
    ],
  },
  {
    id: '24',
    orderCode: '#24',
    customer: 'Trần Minh Quân',
    phone: '0903 555 444',
    address: '45 Lê Duẩn, P. Bến Nghé, Q.1, TP. Hồ Chí Minh',
    type: 'Giao hàng',
    status: 'Hoàn thành',
    pointsUsed: 0,
    shippingFee: 15000,
    subtotal: 90000,
    total: 105000,
    createdAt: 'Hôm nay · 10:15',
    items: [
      { name: 'Nước cam tươi nguyên chất', options: 'Không đá', qty: 1, price: 45000 },
      { name: 'Bạc Xỉu Sữa Tươi Sài Gòn', options: 'Đá riêng', qty: 1, price: 45000 },
    ],
  },
  {
    id: '23',
    orderCode: '#23',
    customer: 'Vũ Mạnh Cường',
    phone: '0945 666 777',
    address: '72 Nguyễn Thị Minh Khai, Q.3, TP. Hồ Chí Minh',
    type: 'Giao hàng',
    status: 'Đã hủy',
    pointsUsed: 30,
    shippingFee: 15000,
    subtotal: 100000,
    total: 85000,
    createdAt: 'Hôm qua · 17:40',
    items: [
      { name: 'Cà phê Latte Vani Mịn', options: 'Sữa yến mạch', qty: 1, price: 55000 },
    ],
  },
]

export function OnlineOrders() {
  const [orders, setOrders] = useState<OnlineOrder[]>(initialOrders)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null)

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    const matchSearch =
      o.orderCode.toLowerCase().includes(search.toLowerCase()) ||
      o.customer.toLowerCase().includes(search.toLowerCase()) ||
      o.phone.includes(search)
    return matchStatus && matchSearch
  })

  const handleUpdateStatus = (id: string, nextStatus: OnlineOrderStatus) => {
    setOrders(
      orders.map((o) => (o.id === id ? { ...o, status: nextStatus } : o))
    )
    if (selectedOrder && selectedOrder.id === id) {
      setSelectedOrder({ ...selectedOrder, status: nextStatus })
    }
    toast.success(`Đã cập nhật đơn #${id} sang trạng thái: "${nextStatus}"`)
  }

  const handleCancelOrder = (order: OnlineOrder) => {
    setOrders(
      orders.map((o) => (o.id === order.id ? { ...o, status: 'Đã hủy' } : o))
    )
    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder({ ...selectedOrder, status: 'Đã hủy' })
    }
    toast.warning(`Đã hủy đơn ${order.orderCode} và hoàn trả ${order.pointsUsed} điểm thưởng cho khách hàng!`)
  }

  return (
    <div className="space-y-6 font-sans text-stone-900">
      {/* 1. Bộ lọc trạng thái đơn */}
      <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md min-w-0">
            <Search className="absolute left-3.5 top-3 size-4 text-stone-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã ĐH, khách hàng, SĐT..."
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-stone-200/90 bg-white text-xs md:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#5A3E2B] shadow-xs truncate"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'Chờ xác nhận', label: 'Chờ xác nhận' },
              { id: 'Đang chuẩn bị', label: 'Đang chuẩn bị' },
              { id: 'Đang giao', label: 'Đang giao' },
              { id: 'Hoàn thành', label: 'Hoàn thành' },
              { id: 'Đã hủy', label: 'Đã hủy' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  'px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer border',
                  statusFilter === tab.id
                    ? 'bg-[#5A3E2B] text-white border-[#5A3E2B] shadow-xs'
                    : 'bg-stone-100/90 text-stone-700 border-stone-200/90 hover:text-stone-950 hover:bg-stone-200/60'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Bảng đơn hàng online */}
        <div className="overflow-x-auto rounded-lg border border-stone-200/90 bg-white">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-stone-200/90 bg-stone-50/60 text-stone-500 font-semibold uppercase tracking-wider text-xs">
                <th className="py-3 px-3">Mã ĐH</th>
                <th className="py-3 px-3">Khách hàng</th>
                <th className="py-3 px-3">Loại đơn</th>
                <th className="py-3 px-3">Trạng thái</th>
                <th className="py-3 px-3 text-right">Tổng tiền</th>
                <th className="py-3 px-3">Thời gian đặt</th>
                <th className="py-3 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-stone-50/60 transition-colors">
                  <td className="py-3.5 px-3 font-mono font-bold text-[#5A3E2B]">
                    {order.orderCode}
                  </td>
                  <td className="py-3.5 px-3">
                    <strong className="text-stone-900 block font-bold">{order.customer}</strong>
                    <span className="text-[11px] font-mono text-stone-500">{order.phone}</span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                        order.type === 'Giao hàng'
                          ? 'bg-blue-50/90 text-blue-900 border-blue-200'
                          : 'bg-stone-100/90 text-stone-800 border-stone-200'
                      )}
                    >
                      {order.type === 'Giao hàng' ? <Truck className="size-3" /> : <Package className="size-3" />}
                      <span>{order.type}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border',
                        order.status === 'Chờ xác nhận' && 'bg-amber-50/90 text-amber-950 border-amber-300/80',
                        order.status === 'Đang chuẩn bị' && 'bg-purple-50/90 text-purple-950 border-purple-300/80',
                        order.status === 'Đang giao' && 'bg-blue-50/90 text-blue-950 border-blue-300/80',
                        order.status === 'Hoàn thành' && 'bg-emerald-50/90 text-emerald-900 border-emerald-300/80',
                        order.status === 'Đã hủy' && 'bg-rose-50/90 text-rose-950 border-rose-300/80'
                      )}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right font-black text-[#5A3E2B] tabular-nums text-sm">
                    {order.total.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="py-3.5 px-3 text-xs text-stone-500 font-mono">
                    {order.createdAt}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedOrder(order)}
                      className="h-8 px-2.5 rounded-md text-xs border-stone-200 bg-white hover:bg-stone-50 text-stone-700 gap-1.5 shadow-2xs"
                    >
                      <Eye className="size-3.5" />
                      <span>Chi tiết</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CHI TIẾT ĐƠN HÀNG ONLINE & XỬ LÝ TRẠNG THÁI */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        {selectedOrder && (
          <DialogContent className="max-w-lg rounded-xl border-stone-200 bg-white text-stone-900 p-6 font-sans shadow-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-xl font-bold text-stone-900 flex items-center gap-2">
                  <Globe className="size-5 text-[#5A3E2B]" />
                  <span>Chi tiết đơn online {selectedOrder.orderCode}</span>
                </DialogTitle>
                <Badge className="bg-[#5A3E2B] text-white text-xs rounded-full px-2.5 py-0.5">{selectedOrder.status}</Badge>
              </div>
              <DialogDescription className="text-xs text-stone-500">
                Đặt lúc {selectedOrder.createdAt} · Phương thức: {selectedOrder.type}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-xs">
              {/* Thông tin người nhận */}
              <div className="rounded-lg border border-stone-200/90 bg-[#F9F7F4] p-3.5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">Khách hàng:</span>
                  <strong className="text-stone-900">{selectedOrder.customer}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Số điện thoại:</span>
                  <span className="font-mono text-stone-800">{selectedOrder.phone}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-stone-500 shrink-0">Địa chỉ giao:</span>
                  <span className="text-stone-800 text-right">{selectedOrder.address}</span>
                </div>
              </div>

              {/* Danh sách món trong đơn */}
              <div>
                <h4 className="font-bold text-xs text-stone-900 mb-2 flex items-center gap-1.5">
                  <UtensilsCrossed className="size-4 text-[#5A3E2B]" />
                  <span>Danh sách món đặt ({selectedOrder.items.length} món)</span>
                </h4>
                <div className="rounded-lg border border-stone-200/90 bg-white divide-y divide-stone-100 shadow-2xs">
                  {selectedOrder.items.map((it, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <strong className="text-stone-900 block">{it.name}</strong>
                        <span className="text-stone-500 text-[11px] block">{it.options}</span>
                        <span className="text-stone-400 text-[10px]">Số lượng: x{it.qty}</span>
                      </div>
                      <span className="font-bold text-stone-900 tabular-nums">
                        {(it.price * it.qty).toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tính toán thanh toán */}
              <div className="rounded-lg border border-stone-200/90 bg-[#F9F7F4] p-3.5 space-y-1.5">
                <div className="flex justify-between text-stone-600">
                  <span>Tạm tính tiền món:</span>
                  <span className="font-mono tabular-nums">{selectedOrder.subtotal.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Phí giao hàng:</span>
                  <span className="font-mono tabular-nums">+{selectedOrder.shippingFee.toLocaleString('vi-VN')} đ</span>
                </div>
                {selectedOrder.pointsUsed > 0 && (
                  <div className="flex justify-between text-emerald-800 font-semibold">
                    <span>Khấu trừ điểm thưởng ({selectedOrder.pointsUsed} điểm):</span>
                    <span className="font-mono tabular-nums">-{ (selectedOrder.pointsUsed * 1000).toLocaleString('vi-VN') } đ</span>
                  </div>
                )}
                <div className="pt-2 border-t border-stone-200 flex justify-between font-bold text-sm text-stone-900">
                  <span>Tổng tiền thanh toán:</span>
                  <span className="text-base text-[#5A3E2B] tabular-nums font-black">{selectedOrder.total.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              {/* Nút chuyển trạng thái quy trình */}
              <div className="space-y-2 pt-1">
                <label className="font-bold text-stone-700 text-xs block">Cập nhật tiến độ đơn hàng:</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Đang chuẩn bị')}
                    className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs h-9 px-3 gap-1 shadow-2xs"
                  >
                    <span>Chuẩn bị món</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Đang giao')}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 px-3 gap-1 shadow-2xs"
                  >
                    <span>Giao hàng</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Hoàn thành')}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-3 gap-1 shadow-2xs"
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>Hoàn thành đơn</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancelOrder(selectedOrder)}
                    className="rounded-lg border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs h-9 px-3 gap-1 ml-auto shadow-2xs"
                  >
                    <XCircle className="size-3.5" />
                    <span>Hủy & Hoàn điểm</span>
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="ghost"
                onClick={() => setSelectedOrder(null)}
                className="h-10 rounded-lg text-xs text-stone-500 hover:text-stone-800"
              >
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
export default OnlineOrders
