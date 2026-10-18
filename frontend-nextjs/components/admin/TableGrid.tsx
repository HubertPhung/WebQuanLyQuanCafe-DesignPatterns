'use client'

import { useEffect, useState, useTransition } from 'react'
import { CheckCircle2, Clock, DollarSign, Filter, LayoutGrid, Users, Utensils } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatCurrency } from '@/lib/admin/format'
import { type FloorTable, type Order, type TableStatus } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import { DEFAULT_BRANCH_ID } from '@/lib/branches'

interface TableGridProps {
  tables?: FloorTable[]
  openOrders?: Order[]
  onUpdateStatus?: (tableId: number, status: TableStatus, guestCount: number) => Promise<void>
}

const defaultTables: FloorTable[] = Array.from({ length: 15 }, (_, i) => {
  const id = i + 1
  const zone = id <= 7 ? 'Main Floor' : id <= 11 ? 'Patio' : 'Coffee Bar'
  const statuses: TableStatus[] = ['available', 'occupied', 'reserved', 'cleaning']
  const status = id === 1 ? 'occupied' : id === 2 ? 'available' : id === 3 ? 'occupied' : id === 4 ? 'reserved' : statuses[i % 4]
  return {
    id,
    branch: DEFAULT_BRANCH_ID,
    name: `Table ${id}`,
    seats: id <= 4 ? 4 : id <= 11 ? 2 : 1,
    zone,
    status,
    guestCount: status === 'occupied' ? (id <= 4 ? 3 : 2) : 0,
    occupiedSince: status === 'occupied' ? new Date(Date.now() - (id * 7 + 10) * 60000) : null,
    updatedAt: new Date(),
  }
})

const tone: Record<TableStatus, string> = {
  available: 'border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:border-emerald-400 hover:shadow-sm shadow-2xs',
  occupied: 'border-amber-300 bg-amber-50/90 text-amber-900 hover:border-amber-400 hover:shadow-sm shadow-2xs ring-1 ring-amber-300/60',
  reserved: 'border-blue-200 bg-blue-50/80 text-blue-900 hover:border-blue-400 hover:shadow-sm shadow-2xs',
  cleaning: 'border-stone-200 bg-stone-100 text-stone-700 hover:border-stone-400 hover:shadow-sm shadow-2xs',
}

const statusBadgeColor: Record<TableStatus, string> = {
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  occupied: 'bg-amber-50 text-amber-700 border-amber-300',
  reserved: 'bg-blue-50 text-blue-700 border-blue-200',
  cleaning: 'bg-stone-100 text-stone-700 border-stone-200',
}

const statusTextVi: Record<TableStatus, { vi: string; en: string }> = {
  available: { vi: 'Bàn trống', en: 'Available' },
  occupied: { vi: 'Đang phục vụ', en: 'Occupied' },
  reserved: { vi: 'Đã đặt trước', en: 'Reserved' },
  cleaning: { vi: 'Đang dọn dẹp', en: 'Needs Cleaning' },
}

const zoneNames: Record<string, string> = {
  'Main Floor': 'Sảnh chính',
  'Patio': 'Sân vườn',
  'Coffee Bar': 'Quầy Bar',
}

export function TableGrid({
  tables = defaultTables,
  openOrders = [],
  onUpdateStatus,
}: TableGridProps) {
  const [tableList, setTableList] = useState<FloorTable[]>(tables)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [zoneFilter, setZoneFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setTableList(tables)
  }, [tables])

  const selected = tableList.find((t) => t.id === selectedId) ?? null
  const selectedOrders = openOrders.filter((o) => o.tableId === selectedId)
  const totalBill = selectedOrders.reduce((sum, o) => sum + o.total, 0)

  const filteredTables = tableList
    .filter((t) => zoneFilter === 'all' || t.zone === zoneFilter)
    .filter((t) => statusFilter === 'all' || t.status === statusFilter)

  const handleSetStatus = (newStatus: TableStatus) => {
    if (!selected) return
    startTransition(async () => {
      const newGuests = newStatus === 'occupied' ? Math.max(selected.guestCount, 1) : 0
      setTableList((prev) =>
        prev.map((t) =>
          t.id === selected.id
            ? { ...t, status: newStatus, guestCount: newGuests, occupiedSince: newStatus === 'occupied' ? new Date() : null }
            : t
        )
      )
      try {
        if (onUpdateStatus) {
          await onUpdateStatus(selected.id, newStatus, newGuests)
        }
        toast.success(`Đã cập nhật ${selected.name.replace('Table', 'Bàn')} sang ${statusTextVi[newStatus].vi}`)
      } catch {
        toast.error('Có lỗi xảy ra khi cập nhật trạng thái bàn.')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200/80 pb-5">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
            <span>Sơ đồ bàn quán cà phê</span>
            <span className="sr-only">Floor plan & Table Management</span>
          </h2>
          <p className="text-sm text-stone-600 font-medium mt-1">
            Theo dõi trực quan trạng thái bàn, số lượng khách và hoá đơn đang phục vụ
          </p>
        </div>

        {/* Status Legend Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {(['available', 'occupied', 'reserved', 'cleaning'] as TableStatus[]).map((st) => (
            <span
              key={st}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border shadow-2xs',
                statusBadgeColor[st]
              )}
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  st === 'available' && 'bg-emerald-600',
                  st === 'occupied' && 'bg-amber-600',
                  st === 'reserved' && 'bg-blue-600',
                  st === 'cleaning' && 'bg-stone-500'
                )}
              />
              <span>{statusTextVi[st].vi}</span>
              <span className="sr-only">({statusTextVi[st].en})</span>
            </span>
          ))}
        </div>
      </div>

      {/* Zone Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider mr-2">
          Khu vực:
        </span>
        {[
          { id: 'all', label: 'Tất cả khu vực', en: 'All' },
          { id: 'Main Floor', label: 'Sảnh chính', en: 'Main Floor' },
          { id: 'Patio', label: 'Sân vườn', en: 'Patio' },
          { id: 'Coffee Bar', label: 'Quầy Bar', en: 'Coffee Bar' },
        ].map((zone) => (
          <Button
            key={zone.id}
            size="sm"
            variant={zoneFilter === zone.id ? 'default' : 'outline'}
            onClick={() => setZoneFilter(zone.id)}
            className={`rounded-lg text-xs font-bold h-9 px-4 transition-all ${
              zoneFilter === zone.id
                ? 'bg-[#3E2723] text-white shadow-xs'
                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <span>{zone.label}</span>
            <span className="sr-only">({zone.en})</span>
          </Button>
        ))}
      </div>

      {/* Grid of Tables */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 lg:gap-6">
        {filteredTables.map((table) => {
          const isSelected = selectedId === table.id
          const statusInfo = statusTextVi[table.status]

          return (
            <button
              key={table.id}
              type="button"
              onClick={() => setSelectedId(table.id)}
              className={cn(
                'group relative flex flex-col justify-between rounded-lg border p-5 text-left transition-all duration-200 min-h-[145px]',
                tone[table.status],
                isSelected && 'ring-2 ring-[#3E2723] ring-offset-2'
              )}
            >
              {/* Header: Table Name & Zone */}
              <div className="flex items-start justify-between">
                <div>
                  <strong className="text-lg font-black tracking-tight block text-stone-900">
                    {table.name.replace('Table', 'Bàn')}
                    <span className="sr-only">{table.name}</span>
                  </strong>
                  <span className="text-xs text-stone-500 block mt-0.5">
                    {zoneNames[table.zone] || table.zone}
                  </span>
                </div>

                <Badge
                  variant="outline"
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border-current"
                >
                  {table.seats} chỗ
                </Badge>
              </div>

              {/* Status Indicator & Guests */}
              <div className="mt-4 flex items-center justify-between border-t border-current/15 pt-3 text-xs">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-current" />
                  {statusInfo.vi}
                </span>

                {table.status === 'occupied' && (
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Users className="size-3.5" />
                    {table.guestCount} khách
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Interactive Sheet for Table Details */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="sm:max-w-md bg-white text-stone-900 border-l border-stone-200 p-6 flex flex-col justify-between">
          <div>
            <SheetHeader className="pb-4 border-b border-stone-200">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-2xl font-black text-stone-900">
                  {selected?.name.replace('Table', 'Bàn')} · {selected && (zoneNames[selected.zone] || selected.zone)}
                  <span className="sr-only">{selected?.name}</span>
                </SheetTitle>
                {selected && (
                  <Badge
                    className={cn(
                      'text-xs font-bold px-3 py-1 rounded-full border',
                      statusBadgeColor[selected.status]
                    )}
                  >
                    {statusTextVi[selected.status].vi}
                  </Badge>
                )}
              </div>
              <SheetDescription className="text-xs text-stone-500 mt-1">
                Chi tiết trạng thái phục vụ và hoá đơn hiện tại của bàn
              </SheetDescription>
            </SheetHeader>

            {selected && (
              <div className="py-6 space-y-6 text-sm">
                {/* Table Metadata */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-stone-50 border border-stone-200">
                  <div>
                    <span className="text-xs text-stone-500 block">Sức chứa tối đa:</span>
                    <span className="font-bold text-stone-900 text-base">{selected.seats} chỗ ngồi</span>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500 block">Khách hiện tại:</span>
                    <span className="font-bold text-stone-900 text-base">
                      {selected.guestCount || 0} người
                    </span>
                  </div>
                </div>

                {/* Status Toggle Buttons */}
                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2">
                    Chuyển đổi trạng thái bàn:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['available', 'occupied', 'reserved', 'cleaning'] as TableStatus[]).map((st) => (
                      <Button
                        key={st}
                        variant={selected.status === st ? 'default' : 'outline'}
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleSetStatus(st)}
                        className={`rounded-lg text-xs font-bold h-10 justify-start px-3 transition-all ${
                          selected.status === st
                            ? 'bg-[#3E2723] text-white shadow-xs'
                            : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <span
                          className={cn(
                            'size-2 rounded-full mr-2',
                            st === 'available' && 'bg-emerald-500',
                            st === 'occupied' && 'bg-amber-500',
                            st === 'reserved' && 'bg-blue-500',
                            st === 'cleaning' && 'bg-stone-500'
                          )}
                        />
                        {statusTextVi[st].vi}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Active Orders / Bill summary */}
                <div className="border-t border-stone-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                      Hoá đơn đang phục vụ:
                    </span>
                    <span className="text-base font-black text-[#3E2723] tabular-nums">
                      {formatCurrency(totalBill)}
                    </span>
                  </div>

                  {selectedOrders.length === 0 ? (
                    <p className="text-xs text-stone-500 italic bg-stone-50 p-3 rounded-lg border border-dashed border-stone-200 text-center">
                      Chưa có đơn gọi món nào cho bàn này.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedOrders.map((ord) => (
                        <div key={ord.id} className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs">
                          <div className="flex justify-between font-bold text-stone-900">
                            <span>#{ord.orderCode} ({ord.customer})</span>
                            <span className="tabular-nums">{formatCurrency(ord.total)}</span>
                          </div>
                          <span className="text-[11px] text-stone-500 block mt-1">
                            Trạng thái: {ord.status === 'completed' ? 'Hoàn thành' : 'Đang xử lý'} · Thanh toán: {ord.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="border-t border-stone-200 pt-4">
            <Button
              variant="outline"
              onClick={() => setSelectedId(null)}
              className="w-full rounded-lg border-stone-200 text-stone-700 hover:bg-stone-100"
            >
              Đóng chi tiết
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
export default TableGrid
