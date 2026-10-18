'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  CalendarDays,
  Clock,
  Users,
  MapPin,
  Coffee,
  CheckCircle2,
  Sparkles,
  X,
  Phone,
  User,
  Mail,
  FileText,
  Armchair,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useReservationStore } from '@/lib/store/reservation-store'
import { bookCustomerTable, getCustomerReservationTables } from '@/app/actions/reservation-actions'
import { RESERVATION_TIME_SLOTS } from '@/lib/reservation-rules'
import { formatMoneyVND } from '@/lib/store/cart-store'
import { DEFAULT_BRANCH_ID, branchById, branches, type BranchId } from '@/lib/branches'

interface TableOption {
  id: number
  name: string
  seats: number
  zone: string
  branch?: BranchId
  available?: boolean
}

export function ReservationDialog() {
  const { isOpen, preOrders, closeReservation } = useReservationStore()
  const [isPending, startTransition] = useTransition()

  // Form states
  const [customer, setCustomer] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [guests, setGuests] = useState(2)
  const [branchId, setBranchId] = useState<BranchId>(DEFAULT_BRANCH_ID)
  const [selectedZone, setSelectedZone] = useState<string>('all')
  const [tables, setTables] = useState<TableOption[]>([])
  const [loadingRequest, setLoadingRequest] = useState(false)
  const [loadedFor, setLoadedFor] = useState('')
  const [availabilityVersion, setAvailabilityVersion] = useState(0)
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([])
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('09:30')
  const [selectedDateOption, setSelectedDateOption] = useState<'today' | 'tomorrow' | 'custom'>('today')
  const [customDate, setCustomDate] = useState('')
  const [note, setNote] = useState('')

  // Success state
  const [successCode, setSuccessCode] = useState<string | null>(null)
  const [confirmedData, setConfirmedData] = useState<{
    customer: string
    contact: string
    time: string
    tableName: string
    guests: number
  } | null>(null)

  // Each branch has its own floor; a booking uses the tables of one branch.
  const branchTables = tables.filter(table => (table.branch ?? DEFAULT_BRANCH_ID) === branchId)
  const zones = ['all', ...new Set(branchTables.map(table => table.zone))]
  const chooseBranch = (next: BranchId) => {
    setBranchId(next)
    setSelectedZone('all')
    setSelectedTableIds([])
  }

  const filteredTables = branchTables.filter((t) => {
    if (selectedZone !== 'all' && t.zone !== selectedZone) return false
    return true
  })

  // Ensure selected table is valid
  const selectedTables = tables.filter(table => selectedTableIds.includes(table.id))
  const totalSeats = selectedTables.reduce((sum, table) => sum + table.seats, 0)

  const getDateString = () => {
    const d = new Date()
    if (selectedDateOption === 'tomorrow') {
      d.setDate(d.getDate() + 1)
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d)
    }
    if (selectedDateOption === 'custom' && customDate) {
      return customDate
    }
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d)
  }

  const requestedTime = `${getDateString()}T${selectedTimeSlot}:00+07:00`
  const availabilityKey = `${branchId}/${requestedTime}/${availabilityVersion}`
  const tablesLoading = loadingRequest || loadedFor !== availabilityKey
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoadingRequest(true)
    getCustomerReservationTables(requestedTime, branchId).then(result => {
      if (!active) return
      setTables(result.tables)
      setSelectedTableIds(ids => ids.filter(id => result.tables.some(table => table.id === id && table.available === true)))
      if (!result.ok) toast.error(result.error)
    }).catch(() => {
      if (active) { setTables([]); setSelectedTableIds([]); toast.error('Không kiểm tra được lịch bàn.') }
    }).finally(() => {
      if (active) { setLoadingRequest(false); setLoadedFor(availabilityKey) }
    })
    return () => { active = false }
  }, [isOpen, requestedTime, branchId, availabilityKey])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (tablesLoading || selectedTables.some(table => table.available !== true)) {
      toast.error('Vui lòng chọn bàn còn trống trong khung giờ này.')
      return
    }
    if (!customer.trim()) {
      toast.error('Vui lòng nhập họ tên của bạn.')
      return
    }
    if (!contact.trim()) {
      toast.error('Vui lòng nhập số điện thoại để quán liên hệ giữ chỗ.')
      return
    }

    const dateStr = getDateString()
    if (selectedTableIds.length === 0 || totalSeats < guests) { toast.error('Chọn các bàn có tổng số chỗ đủ cho số khách.'); return }
    const dateTimeStr = `${dateStr}T${selectedTimeSlot}:00+07:00`

    startTransition(async () => {
      const payload = {
        customer,
        contact,
        email: email.trim() || undefined,
        note: note.trim() || undefined,
        dateTime: dateTimeStr,
        guests,
        tableId: selectedTableIds[0],
        tableIds: selectedTableIds,
        branch: branchId,
        preOrders: preOrders.length > 0
          ? preOrders.map((p) => ({ menuItemId: p.id, qty: p.quantity }))
          : undefined,
      }

      const res = await bookCustomerTable(payload)
      if (res.ok && res.id) {
        setSuccessCode(res.id)
        setConfirmedData({
          customer,
          contact,
          time: `${selectedTimeSlot} ngày ${dateStr}`,
          tableName: `${selectedTables.map(table => `${table.name} (${table.zone})`).join(', ')} · ${branchById(branchId).street}`,
          guests,
        })
        toast.success('Đặt bàn thành công! Quán đã ghi nhận lịch hẹn.')
      } else {
        toast.error(res.error || 'Đặt bàn chưa thành công, vui lòng thử lại.')
        setAvailabilityVersion(version => version + 1)
      }
    })
  }

  const handleResetAndClose = () => {
    setSuccessCode(null)
    setConfirmedData(null)
    closeReservation()
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleResetAndClose()}>
      <SheetContent side="right" showCloseButton={false} style={{ width: 'min(100vw, 36rem)' }} className="h-dvh gap-0 overflow-y-auto border-l border-stone-200 bg-white p-0 font-sans text-stone-900 shadow-2xl sm:max-w-xl">
        {/* Header Banner */}
        <div className="relative bg-gradient-to-r from-[#3E2723] via-[#4E342E] to-[#3E2723] p-6 pr-12 text-white">
          <SheetClose className="absolute right-4 top-5 flex size-8 cursor-pointer items-center justify-center rounded-full text-white hover:bg-white/15" aria-label="Đóng bảng đặt bàn"><X className="size-4" /></SheetClose>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-400/20 text-amber-300">
              <Armchair className="size-4" />
            </span>
            <Badge className="bg-amber-400/25 text-amber-200 border-none text-[11px] font-semibold">
              Đà Lạt Cafe
            </Badge>
          </div>
          <SheetTitle className="text-xl sm:text-2xl font-bold font-display tracking-tight text-white">
            Đặt bàn trực tuyến
          </SheetTitle>
          <SheetDescription className="text-xs text-amber-100/80 mt-1 max-w-md">
            Không gian ấm cúng, view ngắm phố mù sương. Đặt trước để chọn được vị trí ưng ý nhất!
          </SheetDescription>
        </div>

        {/* Success View */}
        {successCode && confirmedData ? (
          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="mx-auto flex size-18 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
              <CheckCircle2 className="size-10" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-2xl font-extrabold text-stone-900">Giữ bàn thành công!</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Cảm ơn bạn <strong className="text-stone-800">{confirmedData.customer}</strong>. Quán đã lên lịch chuẩn bị bàn chu đáo cho bạn.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200/80 bg-[#FAF8F5] p-5 text-left text-xs space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-stone-200/70">
                <span className="text-stone-500">Mã đặt bàn:</span>
                <span className="font-mono text-sm font-extrabold text-[#3E2723] bg-amber-100/70 px-2 py-0.5 rounded-md">
                  {successCode}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Vị trí bàn:</span>
                <strong className="text-stone-900">{confirmedData.tableName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Thời gian đến:</span>
                <strong className="text-stone-900">{confirmedData.time}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Số lượng khách:</span>
                <strong className="text-stone-900">{confirmedData.guests} người</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Số điện thoại liên hệ:</span>
                <strong className="text-stone-900">{confirmedData.contact}</strong>
              </div>
              {preOrders.length > 0 && (
                <div className="pt-2 border-t border-stone-200/70">
                  <span className="block text-stone-500 mb-1 font-semibold">Món gọi sẵn kèm theo ({preOrders.length} món):</span>
                  <div className="space-y-1">
                    {preOrders.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-stone-700">
                        <span>{it.quantity}x {it.title}</span>
                        <span className="tabular-nums font-medium">{formatMoneyVND(it.price * it.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] text-stone-400 max-w-md mx-auto">
              💡 Lưu ý nhỏ: Quán sẽ giữ bàn cho bạn trong vòng 15 phút so với giờ hẹn. Nếu có thay đổi lịch trình, bạn vui lòng gọi Hotline <strong className="text-stone-600">0901 234 567</strong> nhé.
            </p>

            <Button
              onClick={handleResetAndClose}
              className="w-full h-11 rounded-xl bg-[#3E2723] hover:bg-[#2b1b18] text-white font-bold text-xs"
            >
              Hoàn tất & Khám phá quán
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* 1. Customer Details */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <User className="size-3.5 text-[#3E2723]" />
                <span>1. Thông tin khách hàng</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] font-medium text-stone-500 block mb-1">Họ và tên *</span>
                  <input
                    required
                    type="text"
                    placeholder="Nguyễn Văn An"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-stone-50/50 font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-medium text-stone-500 block mb-1">Số điện thoại *</span>
                  <input
                    required
                    type="tel"
                    placeholder="0912 345 678"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-stone-50/50 font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
                  />
                </div>
              </div>
            </div>

            {/* 2. Date & Time */}
            <div className="space-y-3 pt-1 border-t border-stone-100">
              <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-[#3E2723]" />
                <span>2. Thời gian đến quán</span>
              </label>

              {/* Day selection */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDateOption('today')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    selectedDateOption === 'today'
                      ? 'border-[#3E2723] bg-amber-50 text-[#3E2723] ring-1 ring-[#3E2723]'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                  }`}
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDateOption('tomorrow')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    selectedDateOption === 'tomorrow'
                      ? 'border-[#3E2723] bg-amber-50 text-[#3E2723] ring-1 ring-[#3E2723]'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                  }`}
                >
                  Ngày mai
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDateOption('custom')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    selectedDateOption === 'custom'
                      ? 'border-[#3E2723] bg-amber-50 text-[#3E2723] ring-1 ring-[#3E2723]'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                  }`}
                >
                  Chọn ngày khác
                </button>
              </div>

              {selectedDateOption === 'custom' && (
                <div>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 text-xs font-semibold text-stone-900"
                  />
                </div>
              )}

              {/* Time slot pills */}
              <div>
                <span className="text-[11px] font-medium text-stone-500 block mb-1.5">Khung giờ đón khách:</span>
                <select aria-label="Khung giờ đón khách" value={selectedTimeSlot} onChange={event => setSelectedTimeSlot(event.target.value)} className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold">
                  {RESERVATION_TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Number of Guests & Zone Selection */}
            <div className="space-y-3 pt-1 border-t border-stone-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="size-3.5 text-[#3E2723]" />
                  <span>3. Số lượng khách: {guests} người</span>
                </label>
                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
                  {[1, 2, 4, 6, 8].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setGuests(num)}
                      className={`size-7 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        guests === num
                          ? 'bg-[#3E2723] text-white shadow-xs'
                          : 'text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Branch pills: the floor below belongs to the chosen branch */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-stone-500 block">Chi nhánh:</span>
                <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Chi nhánh đặt bàn">
                  {branches.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={branchId === option.id}
                      onClick={() => chooseBranch(option.id)}
                      className={`rounded-lg px-2.5 py-2 text-left text-xs cursor-pointer transition-all ${
                        branchId === option.id
                          ? 'bg-amber-100 text-[#3E2723] font-bold border border-amber-300'
                          : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {option.street}
                      <span className="block text-[10px] font-normal text-stone-500">{option.note}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Zone Filter pills */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-stone-500 block">Khu vực bàn mong muốn:</span>
                <div className="flex flex-wrap gap-1.5">
                  {zones.map((zone) => (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => setSelectedZone(zone)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                        selectedZone === zone
                          ? 'bg-amber-100 text-[#3E2723] font-bold border border-amber-300'
                          : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {zone === 'all' ? 'Tất cả khu vực' : zone}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table Selector Dropdown */}
              <div>
                <p className="mb-2 text-xs text-stone-500">Bàn đã có lịch chồng giờ sẽ không chọn được.</p>
                <p className="mb-2 text-xs text-stone-500">Đã chọn {selectedTableIds.length} bàn, tổng {totalSeats} chỗ.</p>
                {tablesLoading && <p className="text-xs text-stone-500" role="status">Đang tải danh sách bàn…</p>}
                <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-stone-200 p-2">
                  {filteredTables.map((t) => (
                    <label key={t.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-xs ${selectedTableIds.includes(t.id) ? 'border-amber-700 bg-amber-50' : 'border-stone-200'}`}>
                      <input type="checkbox" checked={selectedTableIds.includes(t.id)} disabled={tablesLoading || t.available !== true || (!selectedTableIds.includes(t.id) && selectedTableIds.length >= 10)} onChange={event => setSelectedTableIds(ids => event.target.checked ? [...ids, t.id] : ids.filter(id => id !== t.id))} />
                      <span><strong>{t.name.replace(/^Table\s*/i, 'Bàn ')}</strong><span className="block text-stone-500">{t.zone} · {t.seats} chỗ</span><span className="block text-stone-500">{tablesLoading ? 'Đang kiểm tra…' : t.available ? 'Còn trống' : 'Đã có lịch trong khung giờ này'}</span></span>
                    </label>
                  ))}
                  {!tablesLoading && filteredTables.length === 0 && <p className="col-span-2 p-2 text-xs text-stone-500">Không có bàn trong khu vực này.</p>}
                </div>
              </div>
            </div>

            {/* 4. Pre-orders from Cart (if applicable) */}
            {preOrders.length > 0 && (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#3E2723] flex items-center gap-1.5">
                    <Coffee className="size-3.5 text-[#B45309]" />
                    <span>Món đặt trước kèm bàn ({preOrders.length} món)</span>
                  </span>
                  <Badge className="bg-amber-200/80 text-[#3E2723] border-none text-[10px]">
                    Chuẩn bị sẵn khi bạn đến
                  </Badge>
                </div>
                <div className="divide-y divide-amber-200/40 text-xs">
                  {preOrders.map((item, idx) => (
                    <div key={idx} className="py-1.5 flex justify-between items-center text-stone-700">
                      <span>{item.quantity}x {item.title}</span>
                      <span className="tabular-nums font-semibold text-stone-900">{formatMoneyVND(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Special Notes */}
            <div>
              <span className="text-[11px] font-medium text-stone-500 block mb-1">Yêu cầu đặc biệt (không bắt buộc):</span>
              <textarea
                rows={2}
                placeholder="Ví dụ: Bàn gần cửa sổ, ghế trẻ em, chuẩn bị nến sinh nhật..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#3E2723]"
              />
            </div>

            {/* Action buttons */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={isPending || tablesLoading || selectedTableIds.length === 0 || totalSeats < guests}
                className="w-full h-12 rounded-xl bg-[#3E2723] hover:bg-[#2b1b18] text-white font-bold text-sm shadow-md cursor-pointer transition-all"
              >
                {isPending ? 'Đang gửi thông tin giữ bàn...' : 'Xác nhận giữ bàn ngay'}
              </Button>
              <p className="text-center text-[10px] text-stone-400 mt-2">
                🔒 Không thu phí đặt cọc trước · Quán sẽ giữ bàn trong 15 phút.
              </p>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
export default ReservationDialog
