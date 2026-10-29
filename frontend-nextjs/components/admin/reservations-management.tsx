'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  CalendarCheck,
  Clock,
  Download,
  Eye,
  Pencil,
  Filter,
  MonitorCheck,
  Phone,
  Search,
  Users,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { createReservation, transferReservationToPos, updateReservation, updateReservationStatus } from '@/app/admin/actions'
import type { ReservationView } from '@/lib/admin/queries'
import type { FloorTable } from '@/lib/db/schema'
import type { ReservationStatusLabel } from '@/lib/db/mock-store'
import { cn } from '@/lib/utils'
import { defaultEndSlot, hasReservationStarted, reservationRangeError, reservationRangesOverlap } from '@/lib/reservation-rules'
import styles from './reservations-management.module.css'

export type ReservationStatus = ReservationStatusLabel
type Reservation = ReservationView

const emptyForm = { customer: '', contact: '', email: '', date: '', time: '10:00', endTime: '12:00', guests: '2', tableId: '', note: '' }
// Giá trị tableId để giữ các bàn mà phiếu ghép đang có.
const KEEP_GROUP = 'group'

const formDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
const formTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

function bookingTables(r: Reservation): number[] {
  return r.tableIds?.length ? r.tableIds : r.tableId ? [r.tableId] : []
}

const slotTime = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })
const slotDate = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })

function ReservationCustomer({ reservation: r }: { reservation: Reservation }) {
  return (
    <div className={styles.customer}>
      <span className={styles.code}>{r.id}</span>
      <strong className={styles.customerName}>{r.customer}</strong>
      <a href={`tel:${r.contact}`} className={styles.phone}><Phone aria-hidden="true" />{r.contact}</a>
      {r.email && <span className={styles.email}>{r.email}</span>}
      {r.preOrders.length > 0 && <span className={styles.preOrders}><UtensilsCrossed aria-hidden="true" />{r.preOrders.length} món đặt trước</span>}
    </div>
  )
}

function ReservationSchedule({ reservation: r }: { reservation: Reservation }) {
  const date = new Date(r.scheduledAt)
  if (Number.isNaN(date.getTime())) return <span>{r.dateTime}</span>
  return (
    <time className={styles.schedule} dateTime={r.scheduledAt}>
      <strong><Clock aria-hidden="true" />{slotTime.format(date)} – {slotTime.format(new Date(r.endAt))}</strong>
      <span>{slotDate.format(date)}</span>
    </time>
  )
}

function ReservationTables({ reservation: r }: { reservation: Reservation }) {
  return (
    <div className={styles.tableAssignment}>
      <div className={styles.tableTags}>
        {r.table.split(',').map((name, index) => <span key={`${name}-${index}`} className={styles.tableTag}>{name.trim()}</span>)}
      </div>
      <span className={styles.guests}><Users aria-hidden="true" />{r.guests} khách</span>
    </div>
  )
}

function ReservationStatusControl({ reservation: r, disabled, onChange }: {
  reservation: Reservation
  disabled: boolean
  onChange: (reservation: Reservation, status: ReservationStatus) => void
}) {
  return (
    <select
      value={r.status}
      onChange={event => onChange(r, event.target.value as ReservationStatus)}
      disabled={disabled}
      aria-label={`Trạng thái phiếu ${r.id}`}
      className={cn(styles.statusSelect,
        r.status === 'Chờ xác nhận' && styles.statusPending,
        r.status === 'Đã đặt' && styles.statusConfirmed,
        r.status === 'Hoàn thành' && styles.statusCompleted,
        r.status === 'Đã hủy' && styles.statusCancelled,
      )}
    >
      <option value="Chờ xác nhận" disabled={r.status !== 'Chờ xác nhận'}>Chờ xác nhận</option>
      <option value="Đã đặt">Đã xác nhận</option>
      <option value="Hoàn thành" disabled>Đã nhận bàn</option>
      <option value="Đã hủy">Đã hủy</option>
    </select>
  )
}

function ReservationActions({ reservation: r, pending, canChange, canOpen, onView, onEdit, onCancel, onOpen }: {
  reservation: Reservation
  pending: boolean
  canChange: boolean
  canOpen: boolean
  onView: (reservation: Reservation) => void
  onEdit: (reservation: Reservation) => void
  onCancel: (reservation: Reservation, status: ReservationStatus) => void
  onOpen: (reservation: Reservation) => void
}) {
  return (
    <div className={styles.actions}>
      <div className={styles.primaryActions}>
        <Button size="sm" variant="outline" onClick={() => onView(r)} aria-label={`Chi tiết phiếu ${r.id}`} className="h-9 px-2.5 rounded-lg text-xs border-stone-200 bg-white hover:bg-stone-50 text-stone-700 gap-1.5">
          <Eye aria-hidden="true" />Chi tiết
        </Button>
        {canChange && (
          <Button size="sm" disabled={pending || !canOpen} title={!canOpen ? `Chỉ mở POS từ ${r.dateTime}` : undefined} onClick={() => onOpen(r)} className="h-9 px-2.5 rounded-lg text-xs bg-[#5A3E2B] hover:bg-[#684732] text-white font-semibold gap-1.5">
            <MonitorCheck aria-hidden="true" />Sang POS
          </Button>
        )}
      </div>
      {canChange && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => onEdit(r)} aria-label={`Sửa phiếu ${r.id}`} className="h-8 px-2 rounded-lg text-xs text-stone-700 hover:bg-stone-100 gap-1.5">
          <Pencil aria-hidden="true" />Sửa phiếu
        </Button>
      )}
      {canChange && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => onCancel(r, 'Đã hủy')} aria-label={`Hủy đặt bàn ${r.id}`} className="h-8 px-2 rounded-lg text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800 gap-1.5">
          <XCircle aria-hidden="true" />Hủy đặt bàn
        </Button>
      )}
    </div>
  )
}

export function ReservationsManagement({
  reservations: initial,
  tables,
  javaOnline,
  maxGuests,
}: {
  reservations: ReservationView[]
  tables: FloorTable[]
  javaOnline: boolean
  maxGuests: number
}) {
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>(initial)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null)
  const [creating, setCreating] = useState(false)
  // Phiếu đang được sửa; dùng lại form tạo phiếu, điền sẵn giá trị của nó.
  const [editing, setEditing] = useState<Reservation | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [pending, startTransition] = useTransition()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => { setReservations(initial) }, [initial])

  const requestedTime = new Date(`${form.date}T${form.time}:00+07:00`)
  const requestedEnd = new Date(`${form.date}T${form.endTime}:00+07:00`)
  const rangeError = form.date && form.time && form.endTime ? reservationRangeError(requestedTime, requestedEnd) : null
  const bookedTableIds = new Set(reservations
    .filter(res => res.id !== editing?.id && res.status !== 'Đã hủy'
      && reservationRangesOverlap(new Date(res.scheduledAt), new Date(res.endAt), requestedTime, requestedEnd))
    .flatMap(res => res.tableIds?.length ? res.tableIds : res.tableId ? [res.tableId] : []))
  // Đổi giờ đến mà giờ kết thúc không còn cách đủ 30 phút thì gợi ý lại giờ kết thúc.
  const chooseStart = (time: string) => {
    const tooClose = reservationRangeError(new Date(`2000-01-01T${time}:00+07:00`), new Date(`2000-01-01T${form.endTime}:00+07:00`)) !== null
    setForm({ ...form, time, endTime: tooClose ? defaultEndSlot(time) ?? form.endTime : form.endTime })
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const canChangeStatus = (res: Reservation) => res.status === 'Chờ xác nhận' || res.status === 'Đã đặt'
  const canOpenPos = (res: Reservation) => canChangeStatus(res) && hasReservationStarted(new Date(res.scheduledAt), now)

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
      // Phiếu bên Java đi qua PATCH /api/reservations/{code}/status; phiếu cục bộ nằm trong mock
      // store.
      const result = await updateReservationStatus(res.id, res.source, newStatus)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setReservations((current) => current.map((r) => (r.id === res.id ? { ...r, status: newStatus } : r)))
      setSelectedRes((current) => current?.id === res.id ? { ...current, status: newStatus } : current)
      toast.success(`Đã cập nhật trạng thái đặt bàn #${res.id} sang "${newStatus}"`)
    })
  }

  const handleTransferToPOS = (res: Reservation) => {
    startTransition(async () => {
      // ReservationToOrderAdapter (bên Java, hoặc bản sao phía frontend cho phiếu cục bộ) mở đơn
      // POS.
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

  const startEdit = (res: Reservation) => {
    const at = new Date(res.scheduledAt)
    const tableIds = bookingTables(res)
    setForm({
      customer: res.customer,
      contact: res.contact,
      email: res.email,
      date: formDate.format(at),
      time: formTime.format(at),
      endTime: formTime.format(new Date(res.endAt)),
      guests: String(res.guests),
      tableId: tableIds.length > 1 ? KEEP_GROUP : String(tableIds[0] ?? ''),
      note: res.note,
    })
    setSelectedRes(null)
    setEditing(res)
  }

  const closeForm = () => {
    setCreating(false)
    setEditing(null)
    setForm(emptyForm)
  }

  // Các bàn form sẽ đặt: một bàn đã chọn, hoặc các bàn ghép mà phiếu đang sửa giữ lại.
  const chosenTables = form.tableId === KEEP_GROUP && editing ? bookingTables(editing) : form.tableId ? [Number(form.tableId)] : []
  const chosenTaken = chosenTables.some(id => bookedTableIds.has(id))

  const handleSave = () => {
    const guests = Number(form.guests)
    if (!form.customer.trim() || !form.contact.trim() || !form.date || !form.time || chosenTables.length === 0) {
      toast.error('Nhập đủ tên, số điện thoại, ngày giờ và bàn.')
      return
    }
    if (rangeError) { toast.error(rangeError); return }
    if (chosenTaken) { toast.error('Bàn đã được đặt trong khung giờ này. Vui lòng chọn bàn hoặc giờ khác.'); return }
    const input = {
      customer: form.customer,
      contact: form.contact,
      email: form.email,
      note: form.note,
      // Giờ địa phương ở quán (UTC+7), đúng như OperatingHoursValidator bên Java mong đợi.
      dateTime: new Date(`${form.date}T${form.time}:00+07:00`).toISOString(),
      endTime: requestedEnd.toISOString(),
      guests,
      tableId: chosenTables[0],
      tableIds: chosenTables,
    }
    const target = editing
    startTransition(async () => {
      const result = target ? await updateReservation(target.id, target.source, input) : await createReservation(input)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(target ? `Đã lưu phiếu ${target.id}.` : 'Đã tiếp nhận phiếu đặt bàn.', { description: result.message })
      closeForm()
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
          <span className="text-sm font-medium text-emerald-800 block truncate">Đã nhận bàn</span>
          <span className="text-2xl font-bold text-emerald-900 tabular-nums">{completedCount}</span>
        </div>
        <div className="rounded-xl border border-rose-300/80 bg-rose-50/90 p-4 text-center col-span-2 sm:col-span-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span className="text-sm font-medium text-rose-900 block truncate">Đã hủy</span>
          <span className="text-2xl font-bold text-rose-950 tabular-nums">{cancelledCount}</span>
        </div>
      </div>

      <section className={styles.list} aria-label="Danh sách đặt bàn">
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <Search aria-hidden="true" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              aria-label="Tìm kiếm đặt bàn"
              placeholder="Tìm tên khách, số điện thoại, email..."
            />
          </div>
          <div className={styles.toolbarActions}>
            <div className={styles.filter}>
              <Filter aria-hidden="true" />
              <select aria-label="Lọc trạng thái đặt bàn" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="Chờ xác nhận">Chờ xác nhận</option>
                <option value="Đã đặt">Đã xác nhận</option>
                <option value="Hoàn thành">Đã nhận bàn</option>
                <option value="Đã hủy">Đã hủy</option>
              </select>
            </div>
            <Button onClick={handleExportCSV} variant="outline" className="h-10 rounded-lg px-4 border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-sm gap-2">
              <Download aria-hidden="true" />
              Xuất CSV
            </Button>
            <Button onClick={() => setCreating(true)} className="h-10 rounded-lg px-4 bg-[#5A3E2B] hover:bg-[#684732] text-white text-sm font-semibold gap-2">
              <CalendarCheck aria-hidden="true" />
              Tạo đặt bàn
            </Button>
          </div>
        </div>

        {!javaOnline && <p className={styles.notice}>Chưa kết nối được máy chủ. Đang hiển thị các phiếu lưu cục bộ.</p>}
        <div className={styles.results} aria-live="polite">
          <span>Hiển thị <strong>{filtered.length}</strong> / {totalCount} phiếu đặt bàn</span>
          {(search || statusFilter !== 'all') && <button type="button" onClick={() => { setSearch(''); setStatusFilter('all') }}>Xóa bộ lọc</button>}
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <Calendar aria-hidden="true" />
            <h3>{totalCount === 0 ? 'Chưa có phiếu đặt bàn' : 'Không tìm thấy đặt bàn phù hợp'}</h3>
            <p>{totalCount === 0 ? 'Tạo phiếu đặt bàn để bắt đầu tiếp nhận và sắp xếp chỗ cho khách.' : 'Thử tìm theo tên, số điện thoại hoặc chọn trạng thái khác.'}</p>
          </div>
        ) : (
          <>
            <table className={styles.table}>
              <caption className="sr-only">Thông tin khách, thời gian nhận bàn và trạng thái đặt bàn</caption>
              <thead>
                <tr>
                  <th scope="col">Khách hàng</th>
                  <th scope="col">Giờ nhận bàn</th>
                  <th scope="col">Bàn & số khách</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.source + ':' + r.id}>
                    <td><ReservationCustomer reservation={r} /></td>
                    <td><ReservationSchedule reservation={r} /></td>
                    <td><ReservationTables reservation={r} /></td>
                    <td>
                      <ReservationStatusControl reservation={r} disabled={pending || !canChangeStatus(r)} onChange={handleStatusChange} />
                      {canChangeStatus(r) && !canOpenPos(r) && <span className={styles.statusHint}>Chưa đến giờ nhận bàn</span>}
                      {r.status === 'Hoàn thành' && <span className={styles.statusHint}>Đã chuyển sang đơn tại quầy</span>}
                    </td>
                    <td><ReservationActions reservation={r} pending={pending} canChange={canChangeStatus(r)} canOpen={canOpenPos(r)} onView={setSelectedRes} onEdit={startEdit} onCancel={handleStatusChange} onOpen={handleTransferToPOS} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.cards}>
              {filtered.map(r => (
                <article key={r.source + ':' + r.id} className={styles.reservationCard} aria-label={'Phiếu đặt bàn ' + r.id}>
                  <div className={styles.cardHeader}>
                    <ReservationCustomer reservation={r} />
                    <ReservationStatusControl reservation={r} disabled={pending || !canChangeStatus(r)} onChange={handleStatusChange} />
                  </div>
                  <div className={styles.cardDetails}>
                    <div>
                      <h3>Giờ nhận bàn</h3>
                      <ReservationSchedule reservation={r} />
                    </div>
                    <div>
                      <h3>Bàn & số khách</h3>
                      <ReservationTables reservation={r} />
                    </div>
                  </div>
                  {canChangeStatus(r) && !canOpenPos(r) && <p className={styles.statusHint}>Chưa đến giờ nhận bàn</p>}
                  {r.status === 'Hoàn thành' && <p className={styles.statusHint}>Đã chuyển sang đơn tại quầy</p>}
                  <div className={styles.cardFooter}>
                    <ReservationActions reservation={r} pending={pending} canChange={canChangeStatus(r)} canOpen={canOpenPos(r)} onView={setSelectedRes} onEdit={startEdit} onCancel={handleStatusChange} onOpen={handleTransferToPOS} />
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {/* MODAL: XEM CHI TIẾT ĐẶT BÀN & MÓN ĐẶT TRƯỚC */}
      <Dialog open={!!selectedRes} onOpenChange={(open) => !open && setSelectedRes(null)}>
        {selectedRes && (
          <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl rounded-xl border-stone-200 bg-white text-stone-900 p-5 sm:p-6 font-sans shadow-2xl">
            <DialogHeader>
              <DialogTitle className="pr-6 text-xl font-bold leading-snug text-stone-900">
                Phiếu đặt bàn {selectedRes.id}
              </DialogTitle>
              <DialogDescription className="text-sm text-stone-500">
                Thông tin khách hàng và danh sách món được đặt trước.
              </DialogDescription>
              <Badge className="bg-[#5A3E2B] text-white font-semibold text-xs rounded-full px-2.5 py-0.5">{selectedRes.status === 'Hoàn thành' ? 'Đã nhận bàn' : selectedRes.status === 'Đã đặt' ? 'Đã xác nhận' : selectedRes.status}</Badge>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-sm">
              <div className={styles.detailSummary}>
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
                  <span className="text-stone-700">{selectedRes.email || 'Chưa cung cấp'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Khung giờ:</span>
                  <ReservationSchedule reservation={selectedRes} />
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Bàn xếp:</span>
                  <ReservationTables reservation={selectedRes} />
                </div>
              </div>
              {selectedRes.note && <div className="rounded-lg border border-stone-200 bg-stone-50 p-3.5 text-stone-700"><p className="mb-1 text-xs text-stone-500">Ghi chú của khách</p><p className="break-words">{selectedRes.note}</p></div>}

              {/* Danh sách món đặt trước */}
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
              {canChangeStatus(selectedRes) && (
                <Button variant="outline" disabled={pending} onClick={() => startEdit(selectedRes)} className="h-10 rounded-lg text-xs text-stone-700 border-stone-200 gap-1.5">
                  <Pencil className="size-3.5" />Sửa phiếu
                </Button>
              )}
              {canChangeStatus(selectedRes) && (
                <Button variant="outline" disabled={pending} onClick={() => handleStatusChange(selectedRes, 'Đã hủy')} className="h-10 rounded-lg text-xs text-rose-700 border-rose-200">
                  Hủy đặt bàn
                </Button>
              )}
              <Button
                disabled={pending || !canOpenPos(selectedRes)}
                title={canChangeStatus(selectedRes) && !canOpenPos(selectedRes) ? `Chỉ mở POS từ ${selectedRes.dateTime}` : undefined}
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
      <Dialog open={creating || editing !== null} onOpenChange={(open) => { if (!open) closeForm() }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl rounded-xl border-stone-200 bg-white text-stone-900 p-5 sm:p-6 font-sans shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-stone-900">{editing ? `Sửa phiếu ${editing.id}` : 'Tạo phiếu đặt bàn'}</DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Phiếu được kiểm tra giờ mở cửa (07:00–22:00), sức chứa bàn và lịch trùng trước khi ghi nhận.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid grid-cols-2 gap-3 text-xs pt-1"
            onSubmit={(e) => {
              e.preventDefault()
              handleSave()
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
              <input required type="time" aria-label="Giờ đến" value={form.time} onChange={(e) => chooseStart(e.target.value)} className="w-full h-9 rounded-lg border border-stone-200 px-2.5 focus:outline-none focus:border-[#5A3E2B]" />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-stone-600">Giờ kết thúc</span>
              <input required type="time" aria-label="Giờ kết thúc" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full h-9 rounded-lg border border-stone-200 px-2.5 focus:outline-none focus:border-[#5A3E2B]" />
              {rangeError && <span className="block text-[11px] text-rose-700">{rangeError}</span>}
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-stone-600">Bàn</span>
              <select required aria-label="Bàn" value={form.tableId} onChange={(e) => setForm({ ...form, tableId: e.target.value })} className="w-full h-9 rounded-lg border border-stone-200 bg-white px-2 focus:outline-none focus:border-[#5A3E2B]">
                <option value="">Chọn bàn…</option>
                {editing && bookingTables(editing).length > 1 && (
                  <option value={KEEP_GROUP}>Giữ {bookingTables(editing).length} bàn đang ghép ({editing.table})</option>
                )}
                {tables.map((t) => (
                  <option key={t.id} value={String(t.id)} disabled={bookedTableIds.has(t.id)}>
                    {t.name.replace('Table', 'Bàn')} ({t.seats} chỗ){bookedTableIds.has(t.id) ? ' · Đã có lịch' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-stone-600">Số khách</span>
              <input required type="number" min={1} max={maxGuests} aria-label="Số khách" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} className="w-full h-9 rounded-lg border border-stone-200 px-2.5 tabular-nums focus:outline-none focus:border-[#5A3E2B]" />
            </label>
            <label className="col-span-2 space-y-1">
              <span className="font-semibold text-stone-600">Ghi chú</span>
              <input aria-label="Ghi chú" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full h-9 rounded-lg border border-stone-200 px-2.5 focus:outline-none focus:border-[#5A3E2B]" />
            </label>
            <DialogFooter className="col-span-2 pt-2 flex gap-2">
              <Button type="button" variant="ghost" onClick={closeForm} className="h-10 rounded-lg text-xs text-stone-500">
                Huỷ
              </Button>
              <Button type="submit" disabled={pending || chosenTaken} className="h-10 rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold text-xs">
                {editing ? 'Lưu thay đổi' : 'Lưu phiếu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default ReservationsManagement
