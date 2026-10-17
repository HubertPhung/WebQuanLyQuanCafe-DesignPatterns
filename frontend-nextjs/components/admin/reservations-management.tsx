'use client'

import { useState, useTransition } from 'react'
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
import { createReservation, transferReservationToPos, updateReservationStatus } from '@/app/admin/actions'
import type { ReservationView } from '@/lib/admin/queries'
import type { FloorTable } from '@/lib/db/schema'
import type { ReservationStatusLabel } from '@/lib/db/mock-store'
import { cn } from '@/lib/utils'

export type ReservationStatus = ReservationStatusLabel
type Reservation = ReservationView

const emptyForm = { customer: '', contact: '', email: '', date: '', time: '10:00', guests: '2', tableId: '', note: '' }

export function ReservationsManagement({
  reservations: initial,
  tables,
  javaOnline,
}: {
  reservations: ReservationView[]
  tables: FloorTable[]
  javaOnline: boolean
}) {
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>(initial)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [pending, startTransition] = useTransition()

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

  const handleStatusChange = (res: Reservation, newStatus: ReservationStatus) => {
    startTransition(async () => {
      // Java bookings go through PATCH /api/reservations/{code}/status; local ones stay in the mock store.
      const result = await updateReservationStatus(res.id, res.source, newStatus)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setReservations((current) => current.map((r) => (r.id === res.id ? { ...r, status: newStatus } : r)))
      toast.success(`Đã cập nhật trạng thái đặt bàn #${res.id} sang "${newStatus}"`)
    })
  }

  const handleTransferToPOS = (res: Reservation) => {
    startTransition(async () => {
      // ReservationToOrderAdapter (Java, or its frontend mirror for local bookings) opens the POS order.
      const result = await transferReservationToPos(res.id, res.source, res.guests)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Đã chuyển phiếu của "${res.customer}" sang quầy POS (${res.preOrders.length} món đặt trước).`, {
        description: result.message,
      })
      setSelectedRes(null)
      router.push('/admin/pos?tab=kitchen')
    })
  }

  const handleCreate = () => {
    const tableId = Number(form.tableId)
    const guests = Number(form.guests)
    if (!form.customer.trim() || !form.contact.trim() || !form.date || !form.time || !tableId) {
      toast.error('Nhập đủ tên, số điện thoại, ngày giờ và bàn.')
      return
    }
    startTransition(async () => {
      const result = await createReservation({
        customer: form.customer,
        contact: form.contact,
        email: form.email,
        note: form.note,
        // Local time at the café (UTC+7), as the Java OperatingHoursValidator expects.
        dateTime: new Date(`${form.date}T${form.time}:00+07:00`).toISOString(),
        guests,
        tableId,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Đã tiếp nhận phiếu đặt bàn.', { description: result.message })
      setCreating(false)
      setForm(emptyForm)
      router.refresh()
    })
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

            <Button
              onClick={() => setCreating(true)}
              className="h-10 rounded-lg px-4 bg-[#5A3E2B] hover:bg-[#684732] text-white text-xs md:text-sm font-bold gap-2 shadow-xs"
            >
              <CalendarCheck className="size-4" />
              <span>Tạo phiếu đặt bàn</span>
            </Button>
          </div>
        </div>

        {!javaOnline && (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Không kết nối được Backend Java: đang hiển thị phiếu lưu cục bộ. Phiếu mới sẽ được lưu cục bộ.
          </p>
        )}

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
                    <span className="font-mono text-[11px] text-stone-400 block">
                      {r.id}
                      <span className="ml-1.5 font-sans font-semibold text-[10px] text-stone-500">
                        {r.source === 'java' ? '· Java' : '· Cục bộ'}
                      </span>
                    </span>
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
                      onChange={(e) => handleStatusChange(r, e.target.value as ReservationStatus)}
                      disabled={pending}
                      aria-label={`Trạng thái phiếu ${r.id}`}
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
                      <option value="Hoàn thành" disabled>Hoàn thành (qua "Sang POS")</option>
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
                        disabled={pending || r.status === 'Hoàn thành' || r.status === 'Đã hủy'}
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
                disabled={pending || selectedRes.status === 'Hoàn thành' || selectedRes.status === 'Đã hủy'}
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

      {/* MODAL: TẠO PHIẾU ĐẶT BÀN (POST /api/reservations, Chain of Responsibility) */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md rounded-xl border-stone-200 bg-white text-stone-900 p-6 font-sans shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-stone-900">Tạo phiếu đặt bàn</DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Phiếu được kiểm tra giờ mở cửa (07:00–22:00), sức chứa bàn và lịch trùng trước khi ghi nhận.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid grid-cols-2 gap-3 text-xs pt-1"
            onSubmit={(e) => {
              e.preventDefault()
              handleCreate()
            }}
          >
            <label className="col-span-2 space-y-1">
              <span className="font-semibold text-stone-600">Tên khách</span>
              <input required aria-label="Tên khách" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} className="w-full h-9 rounded-lg border border-stone-200 px-2.5 focus:outline-none focus:border-[#5A3E2B]" />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-stone-600">Số điện thoại</span>
              <input required inputMode="tel" aria-label="Số điện thoại" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="w-full h-9 rounded-lg border border-stone-200 px-2.5 font-mono focus:outline-none focus:border-[#5A3E2B]" />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-stone-600">Email</span>
              <input type="email" aria-label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full h-9 rounded-lg border border-stone-200 px-2.5 focus:outline-none focus:border-[#5A3E2B]" />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-stone-600">Ngày</span>
              <input required type="date" aria-label="Ngày" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full h-9 rounded-lg border border-stone-200 px-2.5 focus:outline-none focus:border-[#5A3E2B]" />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-stone-600">Giờ đến</span>
              <input required type="time" aria-label="Giờ đến" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full h-9 rounded-lg border border-stone-200 px-2.5 focus:outline-none focus:border-[#5A3E2B]" />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-stone-600">Bàn</span>
              <select required aria-label="Bàn" value={form.tableId} onChange={(e) => setForm({ ...form, tableId: e.target.value })} className="w-full h-9 rounded-lg border border-stone-200 bg-white px-2 focus:outline-none focus:border-[#5A3E2B]">
                <option value="">Chọn bàn…</option>
                {tables.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name.replace('Table', 'Bàn')} ({t.seats} chỗ)
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-stone-600">Số khách</span>
              <input required type="number" min={1} max={20} aria-label="Số khách" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} className="w-full h-9 rounded-lg border border-stone-200 px-2.5 tabular-nums focus:outline-none focus:border-[#5A3E2B]" />
            </label>
            <label className="col-span-2 space-y-1">
              <span className="font-semibold text-stone-600">Ghi chú</span>
              <input aria-label="Ghi chú" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full h-9 rounded-lg border border-stone-200 px-2.5 focus:outline-none focus:border-[#5A3E2B]" />
            </label>
            <DialogFooter className="col-span-2 pt-2 flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreating(false)} className="h-10 rounded-lg text-xs text-stone-500">
                Huỷ
              </Button>
              <Button type="submit" disabled={pending} className="h-10 rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold text-xs">
                Lưu phiếu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default ReservationsManagement
