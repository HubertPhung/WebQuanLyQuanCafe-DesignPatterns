'use client'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { History, Pencil, Plus, TicketPercent, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { loadVoucherUsages, removeVoucher, saveVoucher } from '@/app/admin/voucher-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import type { AdminVoucher, VoucherInput, VoucherState, VoucherUsageRow } from '@/lib/api-client'
import { cn } from '@/lib/utils'

const vnd = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')} đ`
const day = (iso: string) => iso.split('-').reverse().join('/')

const STATE_LABEL: Record<VoucherState, { label: string; className: string }> = {
  UPCOMING: { label: 'Sắp diễn ra', className: 'bg-sky-100 text-sky-800' },
  RUNNING: { label: 'Đang chạy', className: 'bg-emerald-100 text-emerald-800' },
  EXPIRED: { label: 'Hết hạn', className: 'bg-stone-200 text-stone-700' },
  SOLD_OUT: { label: 'Hết lượt', className: 'bg-amber-100 text-amber-800' },
  DISABLED: { label: 'Đã tắt', className: 'bg-rose-100 text-rose-800' },
}

function today(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}

function emptyInput(): VoucherInput {
  const start = today()
  return {
    code: '', type: 'PERCENT', value: 10, maxDiscount: null, minOrder: 0, maxUses: null, perAccountLimit: null,
    firstOnlineOrderOnly: false, startDate: start, endDate: start, description: '', active: true,
  }
}

function toInput(v: AdminVoucher): VoucherInput {
  const { id: _id, usedCount: _used, state: _state, ...input } = v
  return input
}

function discountLabel(v: AdminVoucher): string {
  if (v.type === 'FIXED') return vnd(v.value)
  return `${v.value}%${v.maxDiscount ? ` (tối đa ${vnd(v.maxDiscount)})` : ''}`
}

// Ô số để trống nghĩa là không giới hạn.
const optionalNumber = (raw: string): number | null => (raw.trim() === '' ? null : Number(raw))

export function VoucherManagement({ vouchers, unavailable }: { vouchers: AdminVoucher[]; unavailable: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState<AdminVoucher | 'new' | null>(null)
  const [form, setForm] = useState<VoucherInput>(emptyInput)
  const [deleting, setDeleting] = useState<AdminVoucher | null>(null)
  const [usages, setUsages] = useState<{ voucher: AdminVoucher; rows: VoucherUsageRow[] | null } | null>(null)
  const [pending, startTransition] = useTransition()

  const sorted = useMemo(() => [...vouchers].sort((a, b) => b.id - a.id), [vouchers])
  const codeLocked = editing !== null && editing !== 'new' && editing.usedCount > 0
  const set = <K extends keyof VoucherInput>(key: K, value: VoucherInput[K]) => setForm((current) => ({ ...current, [key]: value }))

  const openNew = () => {
    setForm(emptyInput())
    setEditing('new')
  }
  const openEdit = (v: AdminVoucher) => {
    setForm(toInput(v))
    setEditing(v)
  }

  const submit = () => {
    startTransition(async () => {
      const result = await saveVoucher(editing === 'new' || editing === null ? null : editing.id, form)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? 'Đã lưu voucher.')
      setEditing(null)
      router.refresh()
    })
  }

  const confirmDelete = () => {
    if (!deleting) return
    startTransition(async () => {
      const result = await removeVoucher(deleting.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? 'Đã xóa voucher.')
      setDeleting(null)
      router.refresh()
    })
  }

  const showUsages = (v: AdminVoucher) => {
    setUsages({ voucher: v, rows: null })
    startTransition(async () => {
      const result = await loadVoucherUsages(v.id)
      if (!result.ok) {
        toast.error(result.error)
        setUsages(null)
        return
      }
      setUsages({ voucher: v, rows: result.data })
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-600">
          {unavailable ? 'Chưa kết nối được backend Java nên chưa tải được danh sách voucher.' : `${vouchers.length} voucher`}
        </p>
        <Button onClick={openNew} disabled={unavailable} className="bg-[#3E2723] hover:bg-[#4A3525] text-white font-semibold cursor-pointer">
          <Plus data-icon="inline-start" />
          Thêm voucher
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Mã</th>
              <th className="px-4 py-3">Giảm</th>
              <th className="px-4 py-3">Đơn tối thiểu</th>
              <th className="px-4 py-3">Đã dùng / Tối đa</th>
              <th className="px-4 py-3">Mỗi tài khoản</th>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-stone-500">
                  <TicketPercent className="mx-auto mb-2 size-6 text-stone-400" />
                  Chưa có voucher nào.
                </td>
              </tr>
            )}
            {sorted.map((v) => (
              <tr key={v.id} className="align-top">
                <td className="px-4 py-3">
                  <div className="font-mono font-bold text-stone-900">{v.code}</div>
                  {v.description && <div className="text-xs text-stone-500">{v.description}</div>}
                  {v.firstOnlineOrderOnly && <div className="text-[11px] text-amber-700">Chỉ đơn online đầu tiên</div>}
                </td>
                <td className="px-4 py-3 tabular-nums">{discountLabel(v)}</td>
                <td className="px-4 py-3 tabular-nums">{v.minOrder > 0 ? vnd(v.minOrder) : '—'}</td>
                <td className="px-4 py-3 tabular-nums">{v.usedCount} / {v.maxUses ?? '∞'}</td>
                <td className="px-4 py-3 tabular-nums">{v.perAccountLimit ? `${v.perAccountLimit} lần` : 'Không giới hạn'}</td>
                <td className="px-4 py-3 tabular-nums whitespace-nowrap">{day(v.startDate)} – {day(v.endDate)}</td>
                <td className="px-4 py-3">
                  <Badge className={cn('text-[11px]', STATE_LABEL[v.state].className)}>{STATE_LABEL[v.state].label}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => showUsages(v)} aria-label={`Ai đã dùng mã ${v.code}`} className="h-8 px-2.5 cursor-pointer">
                      <History className="size-3.5" data-icon="inline-start" />
                      Ai đã dùng
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(v)} aria-label={`Sửa mã ${v.code}`} className="h-8 px-2.5 cursor-pointer">
                      <Pencil className="size-3.5" data-icon="inline-start" />
                      Sửa
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleting(v)} aria-label={`Xóa mã ${v.code}`} className="h-8 px-2.5 text-rose-700 cursor-pointer">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !pending) setEditing(null) }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-stone-900">
              {editing === 'new' || editing === null ? 'Thêm voucher' : `Sửa voucher ${editing.code}`}
            </DialogTitle>
            <DialogDescription className="text-stone-600 text-sm">
              Để trống ô giới hạn nghĩa là không giới hạn. Mã hợp lệ từ 00:00 ngày bắt đầu đến hết ngày hết hạn (giờ Việt Nam).
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="voucher-code">Mã voucher</Label>
              <Input id="voucher-code" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_\-]+" disabled={codeLocked}
                value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="VD: SALE1111" />
              {codeLocked && <p className="text-xs text-stone-500">Mã đã có người dùng nên không đổi được tên mã.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voucher-type">Kiểu giảm</Label>
              <select id="voucher-type" value={form.type} onChange={(e) => set('type', e.target.value as VoucherInput['type'])}
                className="h-9 w-full rounded-md border border-stone-200 bg-white px-3 text-sm">
                <option value="PERCENT">Giảm theo %</option>
                <option value="FIXED">Giảm số tiền</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voucher-value">{form.type === 'PERCENT' ? 'Phần trăm giảm (1–100)' : 'Số tiền giảm (đ)'}</Label>
              <Input id="voucher-value" type="number" required min={1} max={form.type === 'PERCENT' ? 100 : undefined}
                value={form.value} onChange={(e) => set('value', Number(e.target.value))} />
            </div>
            {form.type === 'PERCENT' && (
              <div className="space-y-1.5">
                <Label htmlFor="voucher-max-discount">Mức giảm tối đa (đ)</Label>
                <Input id="voucher-max-discount" type="number" min={1} placeholder="Không giới hạn"
                  value={form.maxDiscount ?? ''} onChange={(e) => set('maxDiscount', optionalNumber(e.target.value))} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="voucher-min-order">Đơn tối thiểu (đ)</Label>
              <Input id="voucher-min-order" type="number" min={0} value={form.minOrder}
                onChange={(e) => set('minOrder', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voucher-max-uses">Tổng số lượt</Label>
              <Input id="voucher-max-uses" type="number" min={1} placeholder="Không giới hạn"
                value={form.maxUses ?? ''} onChange={(e) => set('maxUses', optionalNumber(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voucher-per-account">Số lần mỗi tài khoản</Label>
              <Input id="voucher-per-account" type="number" min={1} placeholder="Không giới hạn"
                value={form.perAccountLimit ?? ''} onChange={(e) => set('perAccountLimit', optionalNumber(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voucher-start">Ngày bắt đầu</Label>
              <Input id="voucher-start" type="date" required value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voucher-end">Ngày hết hạn</Label>
              <Input id="voucher-end" type="date" required min={form.startDate} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="voucher-description">Mô tả cho khách</Label>
              <Input id="voucher-description" maxLength={200} value={form.description ?? ''}
                onChange={(e) => set('description', e.target.value)} placeholder="VD: Sale 11.11 giảm 20% toàn menu" />
            </div>
            <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
              <input type="checkbox" checked={form.firstOnlineOrderOnly} onChange={(e) => set('firstOnlineOrderOnly', e.target.checked)} />
              Chỉ cho đơn online đầu tiên của tài khoản
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
              <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
              Đang bật (bỏ chọn để tạm dừng mã)
            </label>
            <DialogFooter className="gap-2 sm:col-span-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(null)} className="cursor-pointer">Hủy</Button>
              <Button type="submit" disabled={pending} className="bg-[#3E2723] hover:bg-[#4A3525] text-white cursor-pointer">
                {pending && <Spinner data-icon="inline-start" />}
                Lưu voucher
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open && !pending) setDeleting(null) }}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-stone-900">Xóa voucher {deleting?.code}?</DialogTitle>
            <DialogDescription className="text-stone-600 text-sm">
              {deleting && deleting.usedCount > 0
                ? 'Mã đã có người dùng nên sẽ được tắt thay vì xóa, để lịch sử đơn hàng vẫn giữ tên mã.'
                : 'Mã chưa ai dùng sẽ bị xóa hẳn.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={pending} onClick={() => setDeleting(null)} className="cursor-pointer">Giữ lại</Button>
            <Button disabled={pending} onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer">
              {pending && <Spinner data-icon="inline-start" />}
              {deleting && deleting.usedCount > 0 ? 'Tắt mã' : 'Xóa mã'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={usages !== null} onOpenChange={(open) => { if (!open) setUsages(null) }}>
        <DialogContent className="sm:max-w-lg bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-stone-900">Ai đã dùng mã {usages?.voucher.code}</DialogTitle>
            <DialogDescription className="text-stone-600 text-sm">Mỗi dòng là một lượt đã trừ. Đơn bị hủy được trả lượt và không còn ở đây.</DialogDescription>
          </DialogHeader>
          {usages?.rows === null && <div className="flex justify-center py-6"><Spinner /></div>}
          {usages?.rows && usages.rows.length === 0 && <p className="py-4 text-sm text-stone-500">Chưa có ai dùng mã này.</p>}
          {usages?.rows && usages.rows.length > 0 && (
            <ul className="max-h-80 divide-y divide-stone-100 overflow-y-auto text-sm">
              {usages.rows.map((row, index) => (
                <li key={`${row.orderCode ?? 'pending'}-${index}`} className="flex justify-between gap-3 py-2">
                  <span>
                    <span className="font-mono">{row.orderCode ?? 'Đang thanh toán'}</span>
                    <span className="ml-2 text-stone-500">{row.userId ? `Tài khoản #${row.userId}` : 'Khách vãng lai'}</span>
                  </span>
                  <span className="text-right tabular-nums text-stone-700">
                    -{vnd(row.discountAmount)}
                    <span className="block text-xs text-stone-500">
                      {new Date(row.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
