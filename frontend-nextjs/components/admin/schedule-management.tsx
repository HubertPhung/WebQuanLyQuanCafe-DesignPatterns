'use client'

import { useState } from 'react'
import {
  Calendar,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
  AlertCircle,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type ShiftType = 'morning' | 'afternoon' | 'evening'
export type ShiftStatus = 'scheduled' | 'working' | 'completed' | 'absent'

export type ShiftRecord = {
  id: string
  staffId: string
  staffName: string
  initials: string
  staffRole: string
  date: string // YYYY-MM-DD
  dateDisplay: string
  shiftType: ShiftType
  shiftTime: string
  status: ShiftStatus
  note: string
}

const staffList = [
  { id: 'NV-001', name: 'Nguyễn Hoàng Long', initials: 'HL', role: 'Quản lý / Trưởng Barista' },
  { id: 'NV-002', name: 'Trần Mai Phương', initials: 'MP', role: 'Giám sát ca' },
  { id: 'NV-003', name: 'Lê Anh Tuấn', initials: 'AT', role: 'Barista cao cấp' },
  { id: 'NV-004', name: 'Phạm Quỳnh Anh', initials: 'QA', role: 'Thu ngân & Order' },
  { id: 'NV-005', name: 'Đặng Minh Khang', initials: 'MK', role: 'Barista Cold Brew' },
]

const initialShifts: ShiftRecord[] = [
  {
    id: 'SH-01',
    staffId: 'NV-001',
    staffName: 'Nguyễn Hoàng Long',
    initials: 'HL',
    staffRole: 'Trưởng Barista',
    date: '2026-10-14',
    dateDisplay: 'Thứ Tư, 14/10/2026',
    shiftType: 'morning',
    shiftTime: 'Ca sáng: 06:00 - 14:00',
    status: 'working',
    note: 'Hiệu chỉnh máy pha La Marzocco & kiểm tra chất lượng shot Espresso',
  },
  {
    id: 'SH-02',
    staffId: 'NV-002',
    staffName: 'Trần Mai Phương',
    initials: 'MP',
    staffRole: 'Giám sát ca',
    date: '2026-10-14',
    dateDisplay: 'Thứ Tư, 14/10/2026',
    shiftType: 'morning',
    shiftTime: 'Ca sáng: 06:00 - 14:00',
    status: 'working',
    note: 'Điều phối nhân sự sảnh & kiểm soát bàn đặt trước',
  },
  {
    id: 'SH-03',
    staffId: 'NV-004',
    staffName: 'Phạm Quỳnh Anh',
    initials: 'QA',
    staffRole: 'Thu ngân quầy',
    date: '2026-10-14',
    dateDisplay: 'Thứ Tư, 14/10/2026',
    shiftType: 'morning',
    shiftTime: 'Ca sáng: 06:00 - 14:00',
    status: 'working',
    note: 'Trực máy POS 1 & tiếp nhận đơn trực tuyến',
  },
  {
    id: 'SH-04',
    staffId: 'NV-003',
    staffName: 'Lê Anh Tuấn',
    initials: 'AT',
    staffRole: 'Barista cao cấp',
    date: '2026-10-14',
    dateDisplay: 'Thứ Tư, 14/10/2026',
    shiftType: 'afternoon',
    shiftTime: 'Ca chiều: 14:00 - 22:00',
    status: 'scheduled',
    note: 'Phục vụ khách giờ cao điểm & quầy Pour-Over thủ công',
  },
  {
    id: 'SH-05',
    staffId: 'NV-005',
    staffName: 'Đặng Minh Khang',
    initials: 'MK',
    staffRole: 'Barista Cold Brew',
    date: '2026-10-14',
    dateDisplay: 'Thứ Tư, 14/10/2026',
    shiftType: 'afternoon',
    shiftTime: 'Ca chiều: 14:00 - 22:00',
    status: 'scheduled',
    note: 'Pha chế đồ uống đá xay & chuẩn bị bình ngâm Nitro',
  },
  {
    id: 'SH-06',
    staffId: 'NV-001',
    staffName: 'Nguyễn Hoàng Long',
    initials: 'HL',
    staffRole: 'Trưởng Barista',
    date: '2026-10-13',
    dateDisplay: 'Thứ Ba, 13/10/2026',
    shiftType: 'morning',
    shiftTime: 'Ca sáng: 06:00 - 14:00',
    status: 'completed',
    note: 'Hoàn thành ca trực đúng giờ, bàn giao két tiền và nguyên liệu',
  },
  {
    id: 'SH-07',
    staffId: 'NV-002',
    staffName: 'Trần Mai Phương',
    initials: 'MP',
    staffRole: 'Giám sát ca',
    date: '2026-10-13',
    dateDisplay: 'Thứ Ba, 13/10/2026',
    shiftType: 'afternoon',
    shiftTime: 'Ca chiều: 14:00 - 22:00',
    status: 'completed',
    note: 'Kiểm kê bàn ghế và chốt sổ ca tối',
  },
  {
    id: 'SH-08',
    staffId: 'NV-003',
    staffName: 'Lê Anh Tuấn',
    initials: 'AT',
    staffRole: 'Barista cao cấp',
    date: '2026-10-13',
    dateDisplay: 'Thứ Ba, 13/10/2026',
    shiftType: 'morning',
    shiftTime: 'Ca sáng: 06:00 - 14:00',
    status: 'completed',
    note: 'Rang mẻ cà phê Arabica Cầu Đất tươi',
  },
  {
    id: 'SH-09',
    staffId: 'NV-004',
    staffName: 'Phạm Quỳnh Anh',
    initials: 'QA',
    staffRole: 'Thu ngân quầy',
    date: '2026-10-13',
    dateDisplay: 'Thứ Ba, 13/10/2026',
    shiftType: 'evening',
    shiftTime: 'Ca tối: 18:00 - 23:00',
    status: 'absent',
    note: 'Báo nghỉ ốm đột xuất, đã phân công nhân sự ca bù',
  },
]

export function ScheduleManagement() {
  const [shifts, setShifts] = useState<ShiftRecord[]>(initialShifts)
  const [filterStaff, setFilterStaff] = useState<string>('all')
  const [filterMonth, setFilterMonth] = useState<string>('10')
  const [filterYear, setFilterYear] = useState<string>('2026')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Form tạo lịch mới
  const [formStaffId, setFormStaffId] = useState('NV-001')
  const [formDate, setFormDate] = useState('2026-10-15')
  const [formShiftType, setFormShiftType] = useState<ShiftType>('morning')
  const [formNote, setFormNote] = useState('')

  // KPI calculations
  const totalShifts = shifts.length
  const completedCount = shifts.filter((s) => s.status === 'completed').length
  const activeCount = shifts.filter((s) => s.status === 'working' || s.status === 'scheduled').length
  const absentCount = shifts.filter((s) => s.status === 'absent').length

  // Filter logic
  const filteredShifts = shifts.filter((shift) => {
    if (filterStaff !== 'all' && shift.staffId !== filterStaff) return false
    return true
  })

  // Quick attendance actions
  function handleMarkCompleted(id: string) {
    setShifts((curr) =>
      curr.map((s) => (s.id === id ? { ...s, status: 'completed' as ShiftStatus } : s))
    )
  }

  function handleMarkAbsent(id: string) {
    setShifts((curr) =>
      curr.map((s) => (s.id === id ? { ...s, status: 'absent' as ShiftStatus } : s))
    )
  }

  function handleDeleteShift(id: string) {
    setShifts((curr) => curr.filter((s) => s.id !== id))
  }

  // Create new shift submit
  function handleCreateShift(e: React.FormEvent) {
    e.preventDefault()
    const targetStaff = staffList.find((s) => s.id === formStaffId)
    if (!targetStaff) return

    const shiftTimeMap: Record<ShiftType, string> = {
      morning: 'Ca sáng: 06:00 - 14:00',
      afternoon: 'Ca chiều: 14:00 - 22:00',
      evening: 'Ca tối: 18:00 - 23:00',
    }

    const d = new Date(formDate)
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    const dayOfWeek = days[d.getDay()]
    const formattedDate = `${dayOfWeek}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

    const newShift: ShiftRecord = {
      id: `SH-${String(shifts.length + 1).padStart(2, '0')}`,
      staffId: targetStaff.id,
      staffName: targetStaff.name,
      initials: targetStaff.initials,
      staffRole: targetStaff.role,
      date: formDate,
      dateDisplay: formattedDate,
      shiftType: formShiftType,
      shiftTime: shiftTimeMap[formShiftType],
      status: 'scheduled',
      note: formNote.trim() || 'Phân công nhiệm vụ ca trực tiêu chuẩn',
    }

    setShifts([newShift, ...shifts])
    setIsModalOpen(false)
    setFormNote('')
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border border-stone-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Tổng ca trong tháng</span>
            <CalendarDays className="size-4 text-[#5A3E2B]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-stone-900 tabular-nums">{totalShifts} ca</div>
            <p className="text-xs text-stone-500 mt-1">Tháng {filterMonth}/{filterYear} · Chi nhánh 1</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-stone-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Đã hoàn thành</span>
            <CheckCircle2 className="size-4 text-emerald-800" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-emerald-900 tabular-nums">{completedCount} ca</div>
            <p className="text-xs text-stone-500 mt-1">Đã chấm công và đối soát ca trực</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-stone-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Đang trực & Sắp tới</span>
            <Clock className="size-4 text-blue-800" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-blue-950 tabular-nums">{activeCount} ca</div>
            <p className="text-xs text-stone-500 mt-1">Ca trực đã được phê duyệt</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-stone-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Vắng mặt / Nghỉ</span>
            <UserX className="size-4 text-rose-800" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-rose-950 tabular-nums">{absentCount} ca</div>
            <p className="text-xs text-stone-500 mt-1">Ghi nhận vắng ca trong kỳ đối soát</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="rounded-xl border border-stone-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-stone-200/90">
          <div>
            <CardTitle className="text-lg font-bold tracking-tight text-stone-900">Lịch phân ca & Chấm công nhân sự</CardTitle>
            <CardDescription className="text-stone-500 mt-0.5">
              Phân bổ nhân sự theo từng khung giờ ca làm, theo dõi tình trạng chấm công và ghi chú vận hành.
            </CardDescription>
          </div>

          <Button
            onClick={() => setIsModalOpen(true)}
            className="h-10 rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold gap-2 px-4 shadow-sm"
          >
            <Plus className="size-4" />
            + Tạo lịch mới
          </Button>
        </CardHeader>

        <CardContent className="pt-5 flex flex-col gap-4">
          {/* Bộ lọc: Chọn nhân viên, Tháng, Năm */}
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-[#F9F7F4] border border-stone-200/90">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-600">
              <Filter className="size-3.5 text-[#5A3E2B]" />
              <span>Bộ lọc:</span>
            </div>

            {/* Dropdown nhân viên */}
            <div className="flex items-center gap-2">
              <label htmlFor="staff-select" className="text-xs font-medium text-stone-700">Nhân viên:</label>
              <select
                id="staff-select"
                value={filterStaff}
                onChange={(e) => setFilterStaff(e.target.value)}
                className="h-9 rounded-lg bg-white border border-stone-200 px-3 text-xs text-stone-800 focus:outline-none focus:border-[#5A3E2B] truncate max-w-[170px]"
              >
                <option value="all">Tất cả nhân viên (5)</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown tháng */}
            <div className="flex items-center gap-2">
              <label htmlFor="month-select" className="text-xs font-medium text-stone-700">Tháng:</label>
              <select
                id="month-select"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="h-9 rounded-lg bg-white border border-stone-200 px-3 text-xs text-stone-800 focus:outline-none focus:border-[#5A3E2B]"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={String(m)}>
                    Tháng {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown năm */}
            <div className="flex items-center gap-2">
              <label htmlFor="year-select" className="text-xs font-medium text-stone-700">Năm:</label>
              <select
                id="year-select"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="h-9 rounded-lg bg-white border border-stone-200 px-3 text-xs text-stone-800 focus:outline-none focus:border-[#5A3E2B]"
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>

            <div className="ml-auto text-xs text-stone-500">
              Hiển thị <span className="font-bold text-stone-900 tabular-nums">{filteredShifts.length}</span> ca làm việc
            </div>
          </div>

          {/* Bảng phân ca */}
          <div className="rounded-lg border border-stone-200/90 overflow-hidden">
            <Table>
              <TableHeader className="bg-stone-50/60">
                <TableRow className="border-b border-stone-200/90 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-stone-500 uppercase tracking-wider py-3 px-3">Nhân viên</TableHead>
                  <TableHead className="text-xs font-semibold text-stone-500 uppercase tracking-wider py-3 px-3">Ngày làm việc</TableHead>
                  <TableHead className="text-xs font-semibold text-stone-500 uppercase tracking-wider py-3 px-3">Ca làm</TableHead>
                  <TableHead className="text-xs font-semibold text-stone-500 uppercase tracking-wider py-3 px-3">Trạng thái</TableHead>
                  <TableHead className="text-xs font-semibold text-stone-500 uppercase tracking-wider py-3 px-3">Ghi chú</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider py-3 px-3">Chấm công nhanh & Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShifts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-stone-400 text-sm">
                      Không có lịch ca nào phù hợp với bộ lọc đã chọn.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredShifts.map((shift) => (
                    <TableRow key={shift.id} className="border-b border-stone-200/60 hover:bg-stone-50/60 transition-colors">
                      {/* Nhân viên */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 bg-[#3E2723] text-amber-200 border border-stone-200 font-bold text-xs">
                            <AvatarFallback>{shift.initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-bold text-stone-900 text-sm leading-snug">{shift.staffName}</span>
                            <span className="text-[11px] text-stone-500 leading-snug">{shift.staffRole} · {shift.staffId}</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Ngày làm việc */}
                      <TableCell className="font-medium text-xs text-stone-700">
                        {shift.dateDisplay}
                      </TableCell>

                      {/* Ca làm */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs font-semibold px-2.5 py-0.5 rounded-full border',
                            shift.shiftType === 'morning'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : shift.shiftType === 'afternoon'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-purple-50 text-purple-800 border-purple-200'
                          )}
                        >
                          {shift.shiftTime}
                        </Badge>
                      </TableCell>

                      {/* Trạng thái */}
                      <TableCell>
                        {shift.status === 'completed' ? (
                          <Badge className="bg-emerald-50/90 text-emerald-900 border border-emerald-300/80 text-xs font-bold gap-1.5 px-2.5 py-0.5">
                            <span className="size-1.5 rounded-full bg-emerald-600" />
                            Hoàn thành
                          </Badge>
                        ) : shift.status === 'working' ? (
                          <Badge className="bg-blue-50/90 text-blue-950 border border-blue-300/80 text-xs font-bold gap-1.5 px-2.5 py-0.5">
                            <span className="size-1.5 rounded-full bg-blue-600 animate-pulse" />
                            Đang làm việc
                          </Badge>
                        ) : shift.status === 'absent' ? (
                          <Badge className="bg-rose-50/90 text-rose-950 border border-rose-300/80 text-xs font-bold gap-1.5 px-2.5 py-0.5">
                            <span className="size-1.5 rounded-full bg-rose-600" />
                            Vắng
                          </Badge>
                        ) : (
                          <Badge className="bg-stone-100/90 text-stone-900 border border-stone-300/80 text-xs font-bold gap-1.5 px-2.5 py-0.5">
                            <span className="size-1.5 rounded-full bg-stone-500" />
                            Đã xếp lịch
                          </Badge>
                        )}
                      </TableCell>

                      {/* Ghi chú */}
                      <TableCell className="text-xs text-stone-500 max-w-xs truncate">
                        {shift.note}
                      </TableCell>

                      {/* Chấm công nhanh: Hoàn thành (xanh), Vắng (đỏ), Xóa ca */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkCompleted(shift.id)}
                            title="Xác nhận hoàn thành ca trực"
                            className={cn(
                              'h-8 px-2.5 rounded-lg border text-xs gap-1 font-semibold transition-all',
                              shift.status === 'completed'
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            )}
                          >
                            <CheckCircle2 className="size-3.5" />
                            Hoàn thành
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAbsent(shift.id)}
                            title="Đánh dấu vắng mặt"
                            className={cn(
                              'h-8 px-2.5 rounded-lg border text-xs gap-1 font-semibold transition-all',
                              shift.status === 'absent'
                                ? 'bg-rose-600 text-white border-rose-500'
                                : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                            )}
                          >
                            <UserX className="size-3.5" />
                            Vắng
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteShift(shift.id)}
                            title="Xóa ca làm này"
                            className="h-8 px-2 rounded-lg border-stone-200 bg-white text-stone-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal "+ Tạo lịch mới" */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-lg bg-amber-50 text-[#3E2723] flex items-center justify-center border border-amber-200/60">
                  <Calendar className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-stone-900">Tạo lịch phân ca mới</h3>
                  <p className="text-xs text-stone-500">Chọn nhân viên, ngày và khung giờ ca trực</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateShift} className="mt-5 flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-stone-700">Chọn nhân viên *</label>
                <select
                  value={formStaffId}
                  onChange={(e) => setFormStaffId(e.target.value)}
                  className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:border-[#5A3E2B] focus:bg-white"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {s.role} ({s.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-stone-700">Chọn ngày làm việc *</label>
                <input
                  required
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:border-[#5A3E2B] focus:bg-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-stone-700">Chọn ca làm *</label>
                <select
                  value={formShiftType}
                  onChange={(e) => setFormShiftType(e.target.value as ShiftType)}
                  className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:border-[#5A3E2B] focus:bg-white"
                >
                  <option value="morning">Ca sáng: 06:00 - 14:00 (Mở cửa & Phục vụ sáng)</option>
                  <option value="afternoon">Ca chiều: 14:00 - 22:00 (Cao điểm chiều & Đóng cửa)</option>
                  <option value="evening">Ca tối: 18:00 - 23:00 (Tăng cường & Vệ sinh họng pha)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-stone-700">Ghi chú phân công nhiệm vụ</label>
                <textarea
                  rows={3}
                  placeholder="Ghi chú vị trí quầy, nhiệm vụ giao ca..."
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="rounded-lg bg-stone-50 border border-stone-200 p-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#5A3E2B] focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="h-10 px-4 rounded-lg border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  className="h-10 px-5 rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold"
                >
                  Lưu lịch làm việc
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

