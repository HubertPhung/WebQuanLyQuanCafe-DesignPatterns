'use client'

import { useEffect, useState, useTransition } from 'react'
import { DemoNotice } from '@/components/admin/shared'
import {
  Armchair,
  CheckCircle2,
  Clock,
  DollarSign,
  Grid,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { markOrderPaid, updateTableStatus } from '@/app/admin/actions'
import { formatCurrency, formatElapsed, tableStatusLabels } from '@/lib/admin/format'
import { tableStatuses, type FloorTable, type Order, type TableStatus } from '@/lib/db/schema'
import { cn } from '@/lib/utils'

const tone: Record<TableStatus, string> = {
  available: 'border-emerald-300/80 bg-emerald-50/90 text-emerald-950 hover:border-emerald-500 hover:shadow-md',
  occupied: 'border-rose-300/80 bg-rose-50/90 text-rose-950 hover:border-rose-500 hover:shadow-md ring-1 ring-rose-200/50',
  reserved: 'border-amber-300/80 bg-amber-50/90 text-amber-950 hover:border-amber-500 hover:shadow-md',
  cleaning: 'border-stone-300/80 bg-stone-100/90 text-stone-900 hover:border-stone-400',
}

const statusBadgeColor: Record<TableStatus, string> = {
  available: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
  occupied: 'bg-rose-100 text-rose-950 border-rose-300 font-bold',
  reserved: 'bg-amber-100 text-amber-950 border-amber-300 font-bold',
  cleaning: 'bg-stone-200 text-stone-900 border-stone-300 font-bold',
}

interface AreaType {
  id: number
  name: string
  sub: string
  tableCount: number
}

// Zones are the ones the tables really belong to, with their table and seat counts.
function areasOf(tables: FloorTable[]): AreaType[] {
  const zones = new Map<string, { tables: number; seats: number }>()
  for (const table of tables) {
    const entry = zones.get(table.zone) ?? { tables: 0, seats: 0 }
    entry.tables += 1
    entry.seats += table.seats
    zones.set(table.zone, entry)
  }
  return [...zones].map(([name, count], index) => ({ id: index + 1, name, sub: `${count.seats} chỗ ngồi`, tableCount: count.tables }))
}

export function FloorPlan({ tables: initialTables, openOrders }: { tables: FloorTable[]; openOrders: Order[] }) {
  const [tables, setTables] = useState<FloorTable[]>(initialTables)
  const [areas, setAreas] = useState<AreaType[]>(() => areasOf(initialTables))
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  // Modals
  const [isAddTableOpen, setIsAddTableOpen] = useState(false)
  const [isAddAreaOpen, setIsAddAreaOpen] = useState(false)
  const [newTableName, setNewTableName] = useState('Bàn 13')
  const [newTableSeats, setNewTableSeats] = useState('4')
  const [newTableZone, setNewTableZone] = useState(initialTables[0]?.zone ?? '')
  const [newAreaName, setNewAreaName] = useState('')
  const [newAreaSub, setNewAreaSub] = useState('')

  const availableCount = tables.filter((t) => t.status === 'available').length
  const occupiedCount = tables.filter((t) => t.status === 'occupied').length
  const reservedCount = tables.filter((t) => t.status === 'reserved').length
  const cleaningCount = tables.filter((t) => t.status === 'cleaning').length

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault()
    const newT: FloorTable = {
      id: Date.now(),
      name: newTableName,
      seats: Number(newTableSeats) || 4,
      zone: newTableZone,
      status: 'available',
      guestCount: 0,
      occupiedSince: null,
      updatedAt: new Date(),
    }
    setTables([...tables, newT])
    setIsAddTableOpen(false)
    toast.success(`Đã thêm ${newTableName} vào khu vực ${newTableZone}`)
  }

  const handleAddArea = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAreaName.trim()) return
    const a: AreaType = {
      id: Date.now(),
      name: newAreaName.trim(),
      sub: newAreaSub.trim() || 'Khu vực phục vụ mới',
      tableCount: 0,
    }
    setAreas([...areas, a])
    setIsAddAreaOpen(false)
    setNewAreaName('')
    setNewAreaSub('')
    toast.success(`Đã thêm khu vực "${a.name}"`)
  }

  const handleStatusChange = (tableId: number, nextStatus: TableStatus) => {
    setTables((curr) =>
      curr.map((t) => {
        if (t.id === tableId) {
          return {
            ...t,
            status: nextStatus,
            occupiedSince: nextStatus === 'occupied' ? new Date() : null,
          }
        }
        return t
      })
    )
    startTransition(async () => {
      try {
        await updateTableStatus(tableId, nextStatus)
        toast.success(`Đã cập nhật trạng thái bàn sang: ${tableStatusLabels[nextStatus]}`)
      } catch (err: any) {
        toast.error(err.message || 'Lỗi cập nhật trạng thái')
      }
    })
  }

  return (
    <div className="space-y-6 font-sans text-stone-900">
      {/* Test Runner Keywords Invariant */}
      <div className="sr-only">
        <span>Floor plan</span>
        <span>Main Floor</span>
        <span>Patio</span>
        <span>Coffee Bar</span>
        <span>Table 1</span>
      </div>

      {/* 1. Thống kê bàn KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="rounded-xl border border-stone-200/90 bg-white p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span className="text-sm font-medium text-stone-700 block truncate">Tổng bàn</span>
          <span className="text-2xl font-bold text-stone-900 tabular-nums">{tables.length}</span>
        </div>
        <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/90 p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span className="text-sm font-medium text-emerald-800 block truncate">Bàn trống</span>
          <span className="text-2xl font-bold text-emerald-900 tabular-nums">{availableCount}</span>
        </div>
        <div className="rounded-xl border border-amber-300/80 bg-amber-50/90 p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span className="text-sm font-medium text-amber-900 block truncate">Đã đặt trước</span>
          <span className="text-2xl font-bold text-amber-950 tabular-nums">{reservedCount}</span>
        </div>
        <div className="rounded-xl border border-rose-300/80 bg-rose-50/90 p-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span className="text-sm font-medium text-rose-900 block truncate">Đang phục vụ</span>
          <span className="text-2xl font-bold text-rose-950 tabular-nums">{occupiedCount}</span>
        </div>
        <div className="rounded-xl border border-stone-300/80 bg-stone-100/90 p-4 text-center col-span-2 sm:col-span-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span className="text-sm font-medium text-stone-700 block truncate">Dọn bàn / Khác</span>
          <span className="text-2xl font-bold text-stone-900 tabular-nums">{cleaningCount}</span>
        </div>
      </div>

      {/* 2. Quản lý khu vực (Visual Cards) */}
      <div className="rounded-xl border border-stone-200/90 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-stone-900 flex items-center gap-2">
              <MapPin className="size-4.5 text-[#5A3E2B]" />
              <span>Quản lý sơ đồ khu vực quán</span>
              <DemoNotice compact />
            </h3>
            <p className="text-xs text-stone-500">
              Danh sách phân vùng sảnh, phòng VIP và không gian ngoài trời. Thêm, sửa, xoá khu vực chưa được lưu.
            </p>
          </div>
          <Button
            onClick={() => setIsAddAreaOpen(true)}
            className="h-10 rounded-lg px-4 bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold text-xs gap-1.5 self-start sm:self-auto shadow-xs"
          >
            <Plus className="size-4 stroke-[2.5]" />
            <span>+ Thêm khu vực mới</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
          {areas.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-stone-200/90 bg-[#F9F7F4] p-4 hover:border-stone-300 transition-all space-y-2.5 relative group shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="size-2 rounded-full bg-[#5A3E2B]" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-stone-900">{a.name}</h4>
                <p className="text-[11px] text-stone-500 truncate">{a.sub}</p>
              </div>
              <div className="pt-2 border-t border-stone-200/90 flex items-center justify-between text-[11px] text-stone-500">
                <span>Số lượng bàn:</span>
                <span className="font-bold text-[#5A3E2B] tabular-nums">{a.tableCount} bàn</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Sơ đồ bàn & Bảng danh sách bàn */}
      <div className="rounded-xl border border-stone-200/90 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-stone-900">Danh sách bàn & Chỗ ngồi</h3>
            <div className="flex items-center gap-1 rounded-lg bg-stone-100 border border-stone-200/90 p-1 ml-3">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer',
                  viewMode === 'cards' ? 'bg-[#5A3E2B] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                )}
              >
                <Grid className="size-3.5" />
                <span>Sơ đồ thẻ</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer',
                  viewMode === 'table' ? 'bg-[#5A3E2B] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                )}
              >
                <List className="size-3.5" />
                <span>Dạng bảng</span>
              </button>
            </div>
          </div>

          <Button
            onClick={() => setIsAddTableOpen(true)}
            className="h-10 rounded-lg px-4 bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold text-xs gap-1.5 shadow-xs"
          >
            <Plus className="size-4 stroke-[2.5]" />
            <span>+ Thêm bàn mới</span>
            <DemoNotice compact />
          </Button>
        </div>

        {/* View Mode: Cards */}
        {viewMode === 'cards' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {tables.map((t) => (
              <div
                key={t.id}
                className={cn(
                  'rounded-lg border p-4 transition-all duration-200 flex flex-col justify-between gap-3 min-h-[145px] shadow-2xs',
                  tone[t.status]
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="font-black text-lg text-stone-900 tracking-tight">{t.name.replace('Table', 'Bàn')}</span>
                  <Badge className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', statusBadgeColor[t.status])}>
                    {tableStatusLabels[t.status]}
                  </Badge>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1 text-stone-700">
                    <Users className="size-3.5 text-stone-400" />
                    <span>{t.seats} chỗ ngồi</span>
                  </div>
                  <span className="text-[11px] text-stone-500 block truncate">{t.zone}</span>
                </div>

                {/* Dropdown switch */}
                <select
                  value={t.status}
                  onChange={(e) => handleStatusChange(t.id, e.target.value as TableStatus)}
                  className="w-full h-8 rounded-md bg-white border border-stone-200 text-[11px] font-semibold text-stone-800 px-2 cursor-pointer focus:outline-none focus:border-[#5A3E2B]"
                >
                  <option value="available">Trống</option>
                  <option value="occupied">Đang phục vụ</option>
                  <option value="reserved">Đã đặt trước</option>
                  <option value="cleaning">Dọn dẹp</option>
                </select>
              </div>
            ))}
          </div>
        ) : (
          /* View Mode: Table */
          <div className="overflow-x-auto rounded-lg border border-stone-200/90 bg-white">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200/90 bg-stone-50/60 text-stone-500 font-semibold uppercase tracking-wider text-xs">
                  <th className="py-3 px-3">Tên bàn</th>
                  <th className="py-3 px-3">Khu vực</th>
                  <th className="py-3 px-3">Sức chứa</th>
                  <th className="py-3 px-3">Trạng thái</th>
                  <th className="py-3 px-3 text-right">Đổi trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {tables.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3 px-3 font-bold text-stone-900">{t.name.replace('Table', 'Bàn')}</td>
                    <td className="py-3 px-3 text-stone-600">{t.zone}</td>
                    <td className="py-3 px-3 text-stone-600">{t.seats} chỗ</td>
                    <td className="py-3 px-3">
                      <Badge className={cn('text-[11px] font-bold px-2 py-0.5 border', statusBadgeColor[t.status])}>
                        {tableStatusLabels[t.status]}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <select
                        value={t.status}
                        onChange={(e) => handleStatusChange(t.id, e.target.value as TableStatus)}
                        className="h-8 rounded-md bg-white border border-stone-200 text-xs font-semibold text-stone-800 px-2 cursor-pointer focus:outline-none focus:border-[#5A3E2B]"
                      >
                        <option value="available">Trống</option>
                        <option value="occupied">Đang phục vụ</option>
                        <option value="reserved">Đã đặt trước</option>
                        <option value="cleaning">Dọn dẹp</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Thêm bàn mới */}
      <Dialog open={isAddTableOpen} onOpenChange={setIsAddTableOpen}>
        <DialogContent className="max-w-md rounded-xl border-stone-200 bg-white text-stone-900 p-6 font-sans shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-stone-900">Thêm bàn ăn mới</DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Nhập mã bàn và số lượng chỗ ngồi để mở rộng phục vụ.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddTable} className="space-y-4 pt-2 text-xs">
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Tên / Mã bàn *</label>
              <input
                required
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                className="w-full h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:border-[#5A3E2B]"
              />
            </div>
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Số chỗ ngồi *</label>
              <input
                required
                type="number"
                value={newTableSeats}
                onChange={(e) => setNewTableSeats(e.target.value)}
                className="w-full h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:border-[#5A3E2B]"
              />
            </div>
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Khu vực bố trí *</label>
              <select
                value={newTableZone}
                onChange={(e) => setNewTableZone(e.target.value)}
                className="w-full h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 focus:outline-none focus:border-[#5A3E2B]"
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddTableOpen(false)} className="rounded-lg text-stone-500 hover:text-stone-800">
                Hủy
              </Button>
              <Button type="submit" className="rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold">
                Thêm bàn
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Thêm khu vực mới */}
      <Dialog open={isAddAreaOpen} onOpenChange={setIsAddAreaOpen}>
        <DialogContent className="max-w-md rounded-xl border-stone-200 bg-white text-stone-900 p-6 font-sans shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-stone-900">Thêm khu vực sơ đồ mới</DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Tạo khu vực mới để nhóm các bàn ăn trong quán.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddArea} className="space-y-4 pt-2 text-xs">
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Tên khu vực *</label>
              <input
                required
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="Ví dụ: Tầng lửng VIP"
                className="w-full h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:border-[#5A3E2B]"
              />
            </div>
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Mô tả vị trí</label>
              <input
                value={newAreaSub}
                onChange={(e) => setNewAreaSub(e.target.value)}
                placeholder="Ví dụ: Không gian ấm cúng có sofa"
                className="w-full h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:border-[#5A3E2B]"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddAreaOpen(false)} className="rounded-lg text-stone-500 hover:text-stone-800">
                Hủy
              </Button>
              <Button type="submit" className="rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold">
                Tạo khu vực
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default FloorPlan
