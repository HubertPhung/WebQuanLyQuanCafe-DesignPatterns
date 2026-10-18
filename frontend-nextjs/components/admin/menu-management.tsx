'use client'

import { useMemo, useState, useTransition } from 'react'
import { Coffee, Search, Tag, Trash2, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'
import { deleteMenuItem, setItemInStock } from '@/app/admin/actions'
import { AddItemDialog } from '@/components/admin/add-item-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import type { MenuItem } from '@/lib/db/schema'
import { cn } from '@/lib/utils'

// The menu as the POS sells it. Items are created, edited and removed through createMenuItem,
// updateMenuItem and deleteMenuItem (Java first, then the admin store), and switched on or off
// through setItemInStock. Editing and removing need MANAGER. Categories are the names items use;
// a new one appears by typing it when adding or editing an item.
export function MenuManagement({ items, canManage = false }: { items: MenuItem[]; canManage?: boolean }) {
  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [, startTransition] = useTransition()
  const [deleting, setDeleting] = useState<MenuItem | null>(null)
  const [deletePending, startDelete] = useTransition()

  const menuItems = useMemo(() => items.filter((item) => item.kind === 'menu'), [items])
  const categories = useMemo(() => {
    const counts = new Map<string, { total: number; onSale: number }>()
    for (const item of menuItems) {
      const entry = counts.get(item.category) ?? { total: 0, onSale: 0 }
      entry.total += 1
      if (item.inStock) entry.onSale += 1
      counts.set(item.category, entry)
    }
    return [...counts.entries()].map(([name, count]) => ({ name, ...count })).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [menuItems])

  const query = search.trim().toLowerCase()
  const filteredItems = menuItems.filter(
    (item) =>
      (selectedCategory === 'all' || item.category === selectedCategory) &&
      (!query || item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query)),
  )

  function toggleStock(item: MenuItem) {
    setPendingId(item.id)
    startTransition(async () => {
      const result = await setItemInStock(item.id, !item.inStock)
      setPendingId(null)
      if (result.ok) {
        toast.success(item.inStock ? `Đã ngừng bán "${item.name}"` : `Đã mở bán lại "${item.name}"`)
      } else {
        toast.error(result.error)
      }
    })
  }

  function confirmDelete() {
    const item = deleting
    if (!item) return
    startDelete(async () => {
      const result = await deleteMenuItem(item.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Đã xoá "${item.name}" khỏi thực đơn`)
      setDeleting(null)
    })
  }

  const categoryNames = categories.map((category) => category.name)

  return (
    <div className="space-y-6 font-sans text-stone-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200/50">
        <div className="flex items-center gap-1.5 rounded-lg bg-stone-100/90 border border-stone-200/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer',
              activeTab === 'items' ? 'bg-[#5A3E2B] text-white shadow-xs' : 'text-stone-700 hover:text-stone-950',
            )}
          >
            <UtensilsCrossed className="size-4" />
            <span>Món ăn & Thức uống ({menuItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer',
              activeTab === 'categories' ? 'bg-[#5A3E2B] text-white shadow-xs' : 'text-stone-700 hover:text-stone-950',
            )}
          >
            <Tag className="size-4" />
            <span>Danh mục món ({categories.length})</span>
          </button>
        </div>
        {canManage && (
          <AddItemDialog categories={categoryNames} onCreated={() => {
            setActiveTab('items')
            setSearch('')
            setSelectedCategory('all')
          }} />
        )}
      </div>

      {activeTab === 'items' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md min-w-0">
              <Search className="absolute left-3.5 top-3 size-4 text-stone-400 pointer-events-none" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm món ăn, thức uống..."
                aria-label="Tìm kiếm món"
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-stone-200/80 bg-white text-xs md:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#5A3E2B] shadow-2xs truncate"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="menu-category" className="text-xs text-stone-600 font-semibold whitespace-nowrap">
                Danh mục:
              </label>
              <select
                id="menu-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-xs md:text-sm text-stone-800 focus:outline-none focus:border-[#5A3E2B] cursor-pointer shadow-2xs truncate max-w-[180px]"
              >
                <option value="all">Tất cả danh mục</option>
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200/80 bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-stone-200/80 bg-stone-50/60 text-stone-500 font-semibold uppercase tracking-wider text-xs">
                    <th className="py-3 px-3">Ảnh món</th>
                    <th className="py-3 px-3">Tên món</th>
                    <th className="py-3 px-3">Danh mục</th>
                    <th className="py-3 px-3">Đơn giá</th>
                    <th className="py-3 px-3 text-right">Trạng thái bán</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredItems.map((item) => {
                    return (
                      <tr key={item.id} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3 px-3">
                          <div className="size-11 overflow-hidden rounded-md bg-[#F7F5F0] border border-stone-200/80 flex items-center justify-center text-[#5A3E2B]">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt="" className="size-full object-cover" />
                            ) : (
                              <Coffee className="size-4.5" aria-hidden="true" />
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-stone-900">{item.name}</span>
                          {item.recipe && <p className="mt-0.5 max-w-xs truncate text-xs text-stone-500">{item.recipe}</p>}
                        </td>
                        <td className="py-3 px-3">
                          <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-800 border border-stone-200">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-extrabold text-[#5A3E2B] tabular-nums">{item.sellPrice.toLocaleString('vi-VN')} đ</td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Badge
                              className={cn(
                                'rounded-full px-2.5 py-0.5 text-[10px] font-bold',
                                item.inStock
                                  ? 'bg-emerald-50/90 text-emerald-900 border-emerald-300'
                                  : 'bg-stone-100 text-stone-600 border-stone-300',
                              )}
                            >
                              {item.inStock ? 'Đang bán' : 'Ngừng bán'}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={pendingId === item.id}
                              onClick={() => toggleStock(item)}
                              className="h-8 px-2.5 rounded-md border-stone-200/80 bg-white hover:bg-stone-50 text-stone-700 text-xs shadow-2xs"
                            >
                              {item.inStock ? 'Ngừng bán' : 'Mở bán'}
                            </Button>
                            {canManage && (
                              <>
                                <AddItemDialog categories={categoryNames} item={item} />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  aria-label={`Xoá món ${item.name}`}
                                  onClick={() => setDeleting(item)}
                                  className="h-8 px-2.5 rounded-md border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs shadow-2xs cursor-pointer"
                                >
                                  <Trash2 className="size-3.5" data-icon="inline-start" />
                                  Xoá
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-sm text-stone-500">
                        Không có món nào khớp với bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-3">
          <p className="text-xs text-stone-500">
            Danh mục được lấy từ các món đang có. Để tạo danh mục mới, nhập tên danh mục mới khi thêm món.
          </p>
          <div className="rounded-xl border border-stone-200/80 bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-stone-200/80 bg-stone-50/60 text-stone-500 font-semibold uppercase tracking-wider text-xs">
                    <th className="py-3 px-3">Tên danh mục</th>
                    <th className="py-3 px-3 text-center">Số món</th>
                    <th className="py-3 px-3 text-center">Đang bán</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {categories.map((c) => (
                    <tr key={c.name} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3.5 px-3 font-bold text-stone-900">
                        <span className="flex items-center gap-2">
                          <Tag className="size-4 text-[#5A3E2B]" aria-hidden="true" />
                          {c.name}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center tabular-nums">{c.total}</td>
                      <td className="py-3.5 px-3 text-center tabular-nums">{c.onSale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open && !deletePending) setDeleting(null) }}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-stone-900">Xoá món khỏi thực đơn?</DialogTitle>
            <DialogDescription className="text-stone-600 text-sm">
              "{deleting?.name}" sẽ biến mất khỏi thực đơn, quầy POS và trang đặt món. Các đơn đã bán vẫn giữ tên và giá cũ.
              Nếu chỉ tạm hết hàng, hãy dùng "Ngừng bán" thay vì xoá.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={deletePending} onClick={() => setDeleting(null)} className="rounded-lg cursor-pointer">
              Giữ lại
            </Button>
            <Button disabled={deletePending} onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer">
              {deletePending && <Spinner data-icon="inline-start" />}
              Xoá món
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
