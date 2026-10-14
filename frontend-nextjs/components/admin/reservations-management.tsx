'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  MonitorCheck,
  Phone,
  Search,
  User,
  Users,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export type ReservationStatus = 'Chờ xác nhận' | 'Đã đặt' | 'Hoàn thành' | 'Đã hủy'

interface PreOrderItem {
  name: string
  qty: number
  price: number
}

interface Reservation {
  id: string
  customer: string
  contact: string
  email: string
  dateTime: string
  table: string
  guests: number
  status: ReservationStatus
  note: string
  preOrders: PreOrderItem[]
}

const initialReservations: Reservation[] = [
  {
    id: 'RES-001',
    customer: 'Nguyễn Hoàng Nam',
    contact: '0912 345 678',
    email: 'nam.nguyen@gmail.com',
    dateTime: '13/10/2026 · 15:06 - 17:07',
    table: 'Bàn 04',
    guests: 4,
    status: 'Đã đặt',
    note: 'Yêu cầu bàn gần cửa sổ, chuẩn bị trước cà phê.',
    preOrders: [
      { name: 'Cà phê Latte Vani Mịn', qty: 2, price: 55000 },
      { name: 'Bánh Croissant bơ Pháp', qty: 2, price: 45000 },
    ],
  },
  {
    id: 'RES-002',
    customer: 'Trần Thu Hà',
    contact: '0987 654 321',
    email: 'ha.tran@outlook.com',
    dateTime: '13/10/2026 · 18:00 - 20:00',
    table: 'Bàn 07',
    guests: 2,
    status: 'Đã đặt',
    note: 'Kỷ niệm ngày cưới, chuẩn bị nến nhỏ nếu có.',
    preOrders: [
      { name: 'Cold Brew Cam Vàng', qty: 2, price: 55000 },
    ],
  },
  {
    id: 'RES-003',
    customer: 'Lê Minh Khôi',
    contact: '0903 111 222',
    email: 'khoi.le@corp.vn',
    dateTime: '14/10/2026 · 09:00 - 11:30',
    table: 'Phòng họp VIP',
    guests: 6,
    status: 'Chờ xác nhận',
    note: 'Họp đối tác, cần không gian thật yên tĩnh.',
    preOrders: [
      { name: 'Cà phê Muối Đặc Biệt', qty: 4, price: 45000 },
      { name: 'Bạc Xỉu Sữa Tươi Sài Gòn', qty: 2, price: 45000 },
    ],
  },
  {
    id: 'RES-004',
    customer: 'Phạm Thanh Thảo',
    contact: '0934 888 999',
    email: 'thao.pham@gmail.com',
    dateTime: '14/10/2026 · 14:00 - 16:00',
    table: 'Bàn 02',
    guests: 3,
    status: 'Chờ xác nhận',
    note: 'Bàn sinh nhật bạn bè.',
    preOrders: [],
  },
  {
    id: 'RES-005',
    customer: 'Hoàng Văn Dũng',
    contact: '0977 444 555',
    email: 'dung.hoang@gmail.com',
    dateTime: '12/10/2026 · 10:00 - 12:00',
    table: 'Sân vườn 01',
    guests: 5,
    status: 'Hoàn thành',
    note: 'Khách thanh toán thẻ Visa.',
    preOrders: [],
  },
  {
    id: 'RES-006',
    customer: 'Đặng Ngọc Mai',
    contact: '0918 222 333',
    email: 'mai.dang@gmail.com',
    dateTime: '11/10/2026 · 16:30 - 18:30',
    table: 'Bàn 01',
    guests: 2,
    status: 'Hoàn thành',
    note: 'Khách quen chi nhánh.',
    preOrders: [],
  },
  {
    id: 'RES-007',
    customer: 'Bùi Anh Tuấn',
    contact: '0922 666 777',
    email: 'tuan.bui@gmail.com',
    dateTime: '10/10/2026 · 19:00 - 21:00',
    table: 'Bàn 08',
    guests: 4,
    status: 'Đã hủy',
    note: 'Khách báo bận đột xuất.',
    preOrders: [],
  },
]

export function ReservationsManagement() {
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null)

  // Status counters: Tổng (7), Chờ xác nhận (2), Đã xác nhận/đặt (2), Hoàn thành (2), Đã hủy (3)
  const totalCount = reservations.length
  const pendingCount = reservations.filter((r) => r.status === 'Chờ xác nhận').length
  const confirmedCount = reservations.filter((r) => r.status === 'Đã đặt').length
  const completedCount = reservations.filter((r) => r.status === 'Hoàn thành').length
  const cancelledCount = reservations.filter((r) => r.status === 'Đã hủy').length

  const filtered = reservations.filter((r) => {
    const matchSearch =
      r.customer.toLowerCase().includes(search.toLowerCase()) ||
      r.contact.includes(search) ||
      r.email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    return matchSearch && matchStatus
  })

  const handleStatusChange = (id: string, newStatus: ReservationStatus) => {
    setReservations(
      reservations.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    )
    toast.success(`Đã cập nhật trạng thái đặt bàn #${id} sang "${newStatus}"`)
  }

  const handleTransferToPOS = (res: Reservation) => {
    toast.success(`Đã chuyển đơn đặt bàn của "${res.customer}" sang quầy POS với ${res.preOrders.length} món đặt trước!`)
    setSelectedRes(null)
    router.push('/admin/pos')
  }

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Mã đặt bàn,Khách hàng,SĐT,Khung giờ,Bàn,Số khách,Trạng thái']
        .concat(
          reservations.map(
            (r) => `${r.id},${r.customer},${r.contact},${r.dateTime},${r.table},${r.guests},${r.status}`
          )
        )
        .join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `danh-sach-dat-ban-${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Đã xuất file CSV danh sách đặt bàn thành công!')
  }

  return (
    <div className="space-y-6 font-sans text-stone-900">
      {/* 1. Thẻ chỉ số Đặt bàn */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span className="text-sm font-medium text-stone-700 block truncate">Tổng đặt bàn</span>
          <span className="text-2xl font-bold text-stone-900 tabular-nums">{totalCount}</span>
        </div>
        <div className="rounded-xl border border-amber-300/80 bg-amber-50/90 p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span className="text-sm font-medium text-amber-900 block truncate">Chờ xác nhận</span>
          <span className="text-2xl font-bold text-amber-950 tabular-nums">{pendingCount}</span>
        </div>
        <div className="rounded-xl border border-blue-300/80 bg-blue-50/90 p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span className="text-sm font-medium text-blue-900 block truncate">Đã xác nhận</span>
          <span className="text-2xl font-bold text-blue-950 tabular-nums">{confirmedCount}</span>
        </div>
        <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/90 p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span className="text-sm font-medium text-emerald-800 block truncate">Hoàn thành</span>
          <span className="text-2xl font-bold text-emerald-900 tabular-nums">{completedCount}</span>
        </div>
        <div className="rounded-xl border border-rose-300/80 bg-rose-50/90 p-4 text-center col-span-2 sm:col-span-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span className="text-sm font-medium text-rose-900 block truncate">Đã hủy</span>
          <span className="text-2xl font-bold text-rose-950 tabular-nums">{cancelledCount}</span>
        </div>
      </div>

      {/* 2. Thanh công cụ & Bộ lọc */}
      <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md min-w-0">
            <Search className="absolute left-3.5 top-3 size-4 text-stone-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên khách, SĐT, email..."
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-stone-200/90 bg-white text-xs md:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#5A3E2B] shadow-xs truncate"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-lg border border-stone-200/90 bg-white px-3 text-xs md:text-sm text-stone-800 focus:outline-none focus:border-[#5A3E2B] cursor-pointer shadow-xs"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Chờ xác nhận">Chờ xác nhận</option>
              <option value="Đã đặt">Đã đặt</option>
              <option value="Hoàn thành">Hoàn thành</option>
              <option value="Đã hủy">Đã hủy</option>
            </select>

            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="h-10 rounded-lg px-4 border-stone-200/90 bg-white hover:bg-stone-50 text-stone-800 text-xs md:text-sm gap-2 shadow-xs"
            >
              <Download className="size-4 text-[#5A3E2B]" />
              <span>Xuất CSV</span>
            </Button>
          </div>
        </div>

        {/* 3. Bảng đặt bàn */}
        <div className="overflow-x-auto rounded-lg border border-stone-200/90 bg-white">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-stone-200/90 bg-stone-50/60 text-stone-500 font-semibold uppercase tracking-wider text-xs">
                <th className="py-3 px-3">Mã / Khách hàng</th>
                <th className="py-3 px-3">Liên hệ</th>
                <th className="py-3 px-3">Ngày & Giờ đặt</th>
                <th className="py-3 px-3">Bàn & Khách</th>
                <th className="py-3 px-3">Trạng thái</th>
                <th className="py-3 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50/60 transition-colors">
                  <td className="py-3.5 px-3">
                    <span className="font-mono text-[11px] text-stone-400 block">{r.id}</span>
                    <strong className="font-bold text-stone-900 text-sm">{r.customer}</strong>
                    {r.preOrders.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 font-semibold mt-0.5">
                        <UtensilsCrossed className="size-3" /> {r.preOrders.length} món đặt trước
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 font-mono text-stone-600">
                    <div>{r.contact}</div>
                    <div className="text-[11px] text-stone-400 font-sans">{r.email}</div>
                  </td>
                  <td className="py-3.5 px-3 text-stone-600 font-mono text-xs">
                    {r.dateTime}
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="font-semibold text-[#5A3E2B] bg-stone-100/90 px-2 py-0.5 rounded text-xs border border-stone-200">
                      {r.table}
                    </span>
                    <span className="text-stone-500 text-xs ml-2">({r.guests} người)</span>
                  </td>
                  <td className="py-3.5 px-3">
                    <select
                      value={r.status}
                      onChange={(e) => handleStatusChange(r.id, e.target.value as ReservationStatus)}
                      className={cn(
                        'h-8 rounded-lg px-2 text-xs font-bold border cursor-pointer focus:outline-none',
                        r.status === 'Đã đặt' && 'bg-blue-50/90 border-blue-300 text-blue-950',
                        r.status === 'Chờ xác nhận' && 'bg-amber-50/90 border-amber-300 text-amber-950',
                        r.status === 'Hoàn thành' && 'bg-emerald-50/90 border-emerald-300 text-emerald-950',
                        r.status === 'Đã hủy' && 'bg-rose-50/90 border-rose-300 text-rose-950'
                      )}
                    >
                      <option value="Chờ xác nhận">Chờ xác nhận</option>
                      <option value="Đã đặt">Đã đặt</option>
                      <option value="Hoàn thành">Hoàn thành</option>
                      <option value="Đã hủy">Đã hủy</option>
                    </select>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedRes(r)}
                        className="h-8 px-2.5 rounded-md text-xs border-stone-200 bg-white hover:bg-stone-50 text-stone-700 gap-1.5 shadow-2xs"
                      >
                        <Eye className="size-3.5" />
                        <span>Chi tiết</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleTransferToPOS(r)}
                        className="h-8 px-2.5 rounded-md text-xs bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold gap-1.5 shadow-xs"
                      >
                        <MonitorCheck className="size-3.5" />
                        <span>Sang POS</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: XEM CHI TIẾT ĐẶT BÀN & MÓN ĐẶT TRƯỚC */}
      <Dialog open={!!selectedRes} onOpenChange={(open) => !open && setSelectedRes(null)}>
        {selectedRes && (
          <DialogContent className="max-w-md rounded-xl border-stone-200 bg-white text-stone-900 p-6 font-sans shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-stone-900 flex items-center justify-between">
                <span>Chi tiết phiếu đặt #{selectedRes.id}</span>
                <Badge className="bg-[#5A3E2B] text-white font-bold text-xs rounded-full px-2.5 py-0.5">{selectedRes.status}</Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-stone-500">
                Thông tin khách hàng và danh sách món được đặt trước.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-xs">
              <div className="rounded-lg border border-stone-200/90 bg-[#F9F7F4] p-3.5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">Khách hàng:</span>
                  <strong className="text-stone-900">{selectedRes.customer}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Số điện thoại:</span>
                  <span className="font-mono text-stone-700">{selectedRes.contact}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Email:</span>
                  <span className="text-stone-700">{selectedRes.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Khung giờ:</span>
                  <span className="font-mono text-[#5A3E2B] font-bold">{selectedRes.dateTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Bàn xếp:</span>
                  <span className="font-bold text-stone-900">{selectedRes.table} ({selectedRes.guests} khách)</span>
                </div>
                {selectedRes.note && (
                  <div className="pt-2 border-t border-stone-200 text-stone-700">
                    <span className="text-stone-500 block mb-0.5">Ghi chú của khách:</span>
                    <p className="italic bg-white p-2 rounded-lg border border-stone-200/90">{selectedRes.note}</p>
                  </div>
                )}
              </div>

              {/* Pre-ordered items list */}
              <div>
                <h4 className="font-bold text-xs text-stone-900 mb-2 flex items-center gap-1.5">
                  <UtensilsCrossed className="size-4 text-[#5A3E2B]" />
                  <span>Danh sách món khách đặt trước ({selectedRes.preOrders.length} món)</span>
                </h4>
                {selectedRes.preOrders.length === 0 ? (
                  <p className="text-stone-500 text-xs italic bg-stone-50 p-3 rounded-lg border border-stone-200/90">Khách chưa chọn món trước.</p>
                ) : (
                  <div className="rounded-lg border border-stone-200/90 bg-white divide-y divide-stone-100 shadow-2xs">
                    {selectedRes.preOrders.map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-stone-900 block">{item.name}</strong>
                          <span className="text-stone-500 text-[11px]">Số lượng: {item.qty} phần</span>
                        </div>
                        <span className="font-extrabold text-[#5A3E2B] tabular-nums">
                          {(item.price * item.qty).toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-3 flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setSelectedRes(null)}
                className="h-10 rounded-lg text-xs text-stone-500 hover:text-stone-800"
              >
                Đóng
              </Button>
              <Button
                onClick={() => handleTransferToPOS(selectedRes)}
                className="h-10 rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold text-xs gap-1.5"
              >
                <MonitorCheck className="size-4" />
                <span>Mở bán tại quầy POS</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
export default ReservationsManagement
