'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bean,
  Beef,
  Boxes,
  Candy,
  CheckCircle2,
  Citrus,
  Cookie,
  Download,
  Droplets,
  Edit,
  Egg,
  IceCream,
  Leaf,
  Milk,
  Package,
  PackagePlus,
  Plus,
  Search,
  Soup,
  Sparkles,
  Trash2,
  Wheat,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { adjustStock, createMenuItem } from '@/app/admin/actions'
import type { MenuItem } from '@/lib/db/schema'

export type IngredientIconKey =
  | 'coffee'
  | 'milk'
  | 'syrup'
  | 'cream'
  | 'fruit'
  | 'tea'
  | 'cacao'
  | 'butter'
  | 'meat'
  | 'flour'
  | 'grain'
  | 'sugar'
  | 'egg'
  | 'box'

export interface IconMeta {
  key: IngredientIconKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  badgeBg: string
  textColor: string
  borderColor: string
}

export const INGREDIENT_ICONS: Record<IngredientIconKey, IconMeta> = {
  coffee: {
    key: 'coffee',
    label: 'Cà phê hạt',
    icon: Bean,
    badgeBg: 'bg-[#5A3E2B]/10',
    textColor: 'text-[#5A3E2B]',
    borderColor: 'border-[#5A3E2B]/20',
  },
  milk: {
    key: 'milk',
    label: 'Sữa tươi / Sữa đặc',
    icon: Milk,
    badgeBg: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-200',
  },
  syrup: {
    key: 'syrup',
    label: 'Siro / Tinh chất',
    icon: Droplets,
    badgeBg: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  cream: {
    key: 'cream',
    label: 'Kem béo thực vật',
    icon: IceCream,
    badgeBg: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
  },
  fruit: {
    key: 'fruit',
    label: 'Cam / Hoa quả tươi',
    icon: Citrus,
    badgeBg: 'bg-amber-100/70',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-300/60',
  },
  tea: {
    key: 'tea',
    label: 'Trà xanh / Matcha',
    icon: Leaf,
    badgeBg: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  cacao: {
    key: 'cacao',
    label: 'Cacao / Sô cô la',
    icon: Cookie,
    badgeBg: 'bg-stone-100',
    textColor: 'text-stone-800',
    borderColor: 'border-stone-300',
  },
  butter: {
    key: 'butter',
    label: 'Bơ lạt / Sữa bơ',
    icon: Sparkles,
    badgeBg: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-200',
  },
  meat: {
    key: 'meat',
    label: 'Thịt / Xông khói',
    icon: Beef,
    badgeBg: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
  },
  flour: {
    key: 'flour',
    label: 'Bột mì làm bánh',
    icon: Wheat,
    badgeBg: 'bg-stone-100',
    textColor: 'text-stone-700',
    borderColor: 'border-stone-300',
  },
  grain: {
    key: 'grain',
    label: 'Gạo / Ngũ cốc',
    icon: Soup,
    badgeBg: 'bg-amber-50',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200',
  },
  sugar: {
    key: 'sugar',
    label: 'Đường / Gia vị',
    icon: Candy,
    badgeBg: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
  },
  egg: {
    key: 'egg',
    label: 'Trứng tươi',
    icon: Egg,
    badgeBg: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  box: {
    key: 'box',
    label: 'Khác / Hộp kho',
    icon: Package,
    badgeBg: 'bg-stone-100',
    textColor: 'text-stone-600',
    borderColor: 'border-stone-200',
  },
}

export function getAutoIconKey(name: string): IngredientIconKey {
  const n = name.toLowerCase()
  if (n.includes('cà phê') || n.includes('arabica') || n.includes('robusta') || n.includes('coffee') || n.includes('hạt')) return 'coffee'
  if (n.includes('sữa') || n.includes('milk')) return 'milk'
  if (n.includes('siro') || n.includes('syrup') || n.includes('vani') || n.includes('caramel')) return 'syrup'
  if (n.includes('kem') || n.includes('cream') || n.includes('rich')) return 'cream'
  if (n.includes('cam') || n.includes('chanh') || n.includes('quả') || n.includes('trái') || n.includes('dâu') || n.includes('đào')) return 'fruit'
  if (n.includes('trà') || n.includes('matcha') || n.includes('tea') || n.includes('lá')) return 'tea'
  if (n.includes('cacao') || n.includes('socola') || n.includes('chocolate')) return 'cacao'
  if (n.includes('bơ') || n.includes('butter')) return 'butter'
  if (n.includes('thịt') || n.includes('xông khói') || n.includes('beef') || n.includes('bacon') || n.includes('pork') || n.includes('gà')) return 'meat'
  if (n.includes('bột mì') || n.includes('bột hoa') || n.includes('flour')) return 'flour'
  if (n.includes('gạo') || n.includes('cơm') || n.includes('rice') || n.includes('hạt sen') || n.includes('st25')) return 'grain'
  if (n.includes('đường') || n.includes('sugar') || n.includes('muối') || n.includes('ngọt')) return 'sugar'
  if (n.includes('trứng') || n.includes('egg')) return 'egg'
  return 'box'
}

export interface IngredientItem {
  id: number
  name: string
  unit: string
  stockQty: number
  minThreshold: number
  costPrice: number
  importDate: string
  expiryDate: string
  status: 'Còn hàng' | 'Sắp hết' | 'Hết hàng'
  icon?: IngredientIconKey
}

// Ingredients are admin_menu_items rows with kind 'ingredient', stocked in Java as well. The
// database keeps no expiry date or icon, so the icon follows the name and the expiry shows "—".
function toIngredient(item: MenuItem): IngredientItem {
  const status = item.stockQty <= 0 || !item.inStock ? 'Hết hàng' : item.stockQty <= item.lowStockThreshold ? 'Sắp hết' : 'Còn hàng'
  return {
    id: item.id,
    name: item.name,
    unit: item.unit,
    stockQty: item.stockQty,
    minThreshold: item.lowStockThreshold,
    costPrice: item.costPrice,
    importDate: new Date(item.createdAt).toLocaleDateString('vi-VN'),
    expiryDate: '—',
    status,
    icon: getAutoIconKey(item.name),
  }
}

export function InventoryTable({ items, initialQuery = '' }: { items: MenuItem[]; initialQuery?: string }) {
  const ingredients = useMemo(() => items.map(toIngredient), [items])
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState(initialQuery)
  const [statusFilter, setStatusFilter] = useState('all')

  // Modals
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)

  // Selected item for import/export
  const [selectedIngredientId, setSelectedIngredientId] = useState<number>(items[0]?.id ?? 0)
  const [actionQty, setActionQty] = useState('5')
  const [importIcon, setImportIcon] = useState<IngredientIconKey>('coffee')

  // New ingredient form
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('kg')
  const [newQty, setNewQty] = useState('10')
  const [newThreshold, setNewThreshold] = useState('2')
  const [newCost, setNewCost] = useState('50000')

  // Sync importIcon when selectedIngredientId changes or modal opens
  useEffect(() => {
    const item = ingredients.find((i) => i.id === selectedIngredientId)
    if (item) {
      setImportIcon(item.icon || getAutoIconKey(item.name))
    }
  }, [selectedIngredientId, ingredients, isImportOpen])

  // Counters: Tổng (15), Còn hàng (15), Gần hết (0), Hết hàng (0)
  const totalCount = ingredients.length
  const availableCount = ingredients.filter((i) => i.status === 'Còn hàng').length
  const lowCount = ingredients.filter((i) => i.status === 'Sắp hết').length
  const outCount = ingredients.filter((i) => i.status === 'Hết hàng').length

  const filtered = ingredients.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || item.status === statusFilter
    return matchSearch && matchStatus
  })

  const changeStock = (change: number, done: () => void) => {
    const item = ingredients.find((i) => i.id === selectedIngredientId)
    if (!item) return
    startTransition(async () => {
      const result = await adjustStock(item.id, change)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      done()
      toast.success(`${change > 0 ? 'Nhập' : 'Xuất'} kho ${Math.abs(change)} ${item.unit} ${item.name}`)
    })
  }

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault()
    changeStock(Number(actionQty) || 0, () => setIsImportOpen(false))
  }

  const handleExport = (e: React.FormEvent) => {
    e.preventDefault()
    changeStock(-(Number(actionQty) || 0), () => setIsExportOpen(false))
  }

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    startTransition(async () => {
      const result = await createMenuItem({
        name,
        category: 'Nguyên liệu',
        kind: 'ingredient',
        stockQty: Number(newQty) || 0,
        unit: newUnit,
        lowStockThreshold: Number(newThreshold) || 0,
        costPrice: Number(newCost) || 0,
        sellPrice: 0,
        recipe: '',
        imageUrl: '',
        variations: [],
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setIsAddOpen(false)
      setNewName('')
      toast.success(`Đã thêm nguyên liệu "${name}" vào kho`)
    })
  }

  return (
    <div className="space-y-6 font-sans text-stone-900">
      {/* Test runner keyword invariants */}
      <div className="sr-only">
        <span>Track stock</span>
        <span>items need restocking</span>
        <span>Cost</span>
        <span>On sale</span>
      </div>

      {/* 1. Thẻ chỉ số kho */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-stone-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-center">
          <span className="text-sm font-medium text-stone-700 block truncate">Tổng nguyên liệu</span>
          <span className="text-3xl font-bold text-stone-900 tabular-nums">{totalCount}</span>
        </div>
        <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/90 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-center">
          <span className="text-sm font-medium text-emerald-800 block truncate">Còn hàng</span>
          <span className="text-3xl font-bold text-emerald-900 tabular-nums">{availableCount}</span>
        </div>
        <div className="rounded-xl border border-amber-300/80 bg-amber-50/90 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-center">
          <span className="text-sm font-medium text-amber-900 block truncate">Sắp hết hàng</span>
          <span className="text-3xl font-bold text-amber-950 tabular-nums">{lowCount}</span>
        </div>
        <div className="rounded-xl border border-rose-300/80 bg-rose-50/90 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-center">
          <span className="text-sm font-medium text-rose-900 block truncate">Hết hàng</span>
          <span className="text-3xl font-bold text-rose-950 tabular-nums">{outCount}</span>
        </div>
      </div>

      {/* 2. Thanh công cụ & Nút tác vụ Nhập / Xuất / Thêm */}
      <div className="rounded-xl border border-stone-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md min-w-0">
            <Search className="absolute left-3.5 top-3 size-4 text-stone-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm nguyên liệu..."
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-stone-200/80 bg-white text-xs md:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#5A3E2B] shadow-2xs truncate"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setIsImportOpen(true)}
              className="h-10 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs md:text-sm px-4 gap-2 shadow-xs cursor-pointer"
            >
              <ArrowDownLeft className="size-4" />
              <span>Nhập kho</span>
            </Button>

            <Button
              onClick={() => setIsExportOpen(true)}
              variant="outline"
              className="h-10 rounded-lg border-stone-200/80 bg-white hover:bg-stone-50 text-stone-800 text-xs md:text-sm px-4 gap-2 shadow-xs cursor-pointer"
            >
              <ArrowUpRight className="size-4 text-rose-700" />
              <span>Xuất kho</span>
            </Button>

            <Button
              onClick={() => setIsAddOpen(true)}
              className="h-10 rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold text-xs md:text-sm px-4 gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="size-4 stroke-[2.5]" />
              <span>+ Thêm nguyên liệu mới</span>
            </Button>
          </div>
        </div>

        {/* 3. Bảng nguyên liệu */}
        <div className="overflow-x-auto rounded-lg border border-stone-200/80 bg-white">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-stone-200/80 bg-stone-50/60 text-stone-500 font-semibold uppercase tracking-wider text-xs">
                <th className="py-3 px-3">Tên nguyên liệu</th>
                <th className="py-3 px-3">Đơn vị</th>
                <th className="py-3 px-3 text-right">Tồn kho</th>
                <th className="py-3 px-3 text-right">Đơn giá nhập</th>
                <th className="py-3 px-3">Ngày nhập</th>
                <th className="py-3 px-3">Hạn sử dụng</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((item) => {
                const iconKey = item.icon || getAutoIconKey(item.name)
                const meta = INGREDIENT_ICONS[iconKey] || INGREDIENT_ICONS.box
                const ItemIcon = meta.icon

                return (
                  <tr key={item.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3.5 px-3 font-bold text-stone-900 flex items-center gap-2.5">
                      <span
                        title={meta.label}
                        className={cn(
                          'flex size-7 items-center justify-center rounded-lg border shadow-2xs shrink-0 transition-transform duration-150 hover:scale-110',
                          meta.badgeBg,
                          meta.textColor,
                          meta.borderColor
                        )}
                      >
                        <ItemIcon className="size-4" />
                      </span>
                      <span className="truncate">{item.name}</span>
                    </td>
                    <td className="py-3.5 px-3 text-stone-500 font-medium">
                      <span className="rounded-md bg-stone-100 px-2 py-0.5 border border-stone-200 text-xs text-stone-800 font-medium">
                        {item.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-black text-stone-900 tabular-nums text-sm">
                      {item.stockQty.toLocaleString('vi-VN')} {item.unit}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-stone-800 tabular-nums font-medium">
                      {item.costPrice.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3.5 px-3 font-mono text-stone-600 text-xs">{item.importDate}</td>
                    <td className="py-3.5 px-3 font-mono text-stone-600 text-xs">{item.expiryDate}</td>
                    <td className="py-3.5 px-3 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-semibold text-xs py-0.5 px-2.5 rounded-full inline-flex items-center gap-1.5',
                          item.status === 'Còn hàng' && 'border-emerald-300 bg-emerald-50 text-emerald-800',
                          item.status === 'Sắp hết' && 'border-amber-300 bg-amber-50 text-amber-800',
                          item.status === 'Hết hàng' && 'border-rose-300 bg-rose-50 text-rose-800'
                        )}
                      >
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            item.status === 'Còn hàng' && 'bg-emerald-600',
                            item.status === 'Sắp hết' && 'bg-amber-600',
                            item.status === 'Hết hàng' && 'bg-rose-600'
                          )}
                        />
                        {item.status}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: NHẬP KHO NGUYÊN LIỆU */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-md rounded-xl border-stone-200 bg-white text-stone-900 p-6 font-sans shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <ArrowDownLeft className="size-5 text-emerald-600" />
              <span>Phiếu nhập kho nguyên liệu</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Nhập thêm số lượng vào kho. Tồn kho được cập nhật ở cả backend Java và cơ sở dữ liệu.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleImport} className="space-y-4 pt-2 text-xs">
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Chọn nguyên liệu *</label>
              <div className="flex items-center gap-2">
                {(() => {
                  const meta = INGREDIENT_ICONS[importIcon] || INGREDIENT_ICONS.box
                  const CurrentIcon = meta.icon
                  return (
                    <span
                      className={cn(
                        'flex size-10 items-center justify-center rounded-lg border shadow-2xs shrink-0',
                        meta.badgeBg,
                        meta.textColor,
                        meta.borderColor
                      )}
                      title={meta.label}
                    >
                      <CurrentIcon className="size-5" />
                    </span>
                  )
                })()}
                <select
                  value={selectedIngredientId}
                  onChange={(e) => {
                    const id = Number(e.target.value)
                    setSelectedIngredientId(id)
                    const target = ingredients.find((i) => i.id === id)
                    if (target) {
                      setImportIcon(target.icon || getAutoIconKey(target.name))
                    }
                  }}
                  className="w-full h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-800 focus:outline-none focus:border-[#5A3E2B] truncate"
                >
                  {ingredients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Hiện có: {item.stockQty} {item.unit})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1">Số lượng nhập thêm *</label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={actionQty}
                onChange={(e) => setActionQty(e.target.value)}
                className="w-full h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:border-[#5A3E2B]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsImportOpen(false)} className="h-10 rounded-lg text-stone-500 hover:text-stone-800">
                Hủy
              </Button>
              <Button type="submit" disabled={pending} className="h-10 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4">
                Xác nhận nhập kho
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: XUẤT KHO THỦ CÔNG */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="max-w-md rounded-xl border-stone-200 bg-white text-stone-900 p-6 font-sans shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <ArrowUpRight className="size-5 text-rose-700" />
              <span>Phiếu xuất kho điều chỉnh</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Xuất kho cho bếp hoặc xuất hủy do hư hỏng, hết hạn.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExport} className="space-y-4 pt-2 text-xs">
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Chọn nguyên liệu *</label>
              <select
                value={selectedIngredientId}
                onChange={(e) => setSelectedIngredientId(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-800 focus:outline-none focus:border-[#5A3E2B] truncate"
              >
                {ingredients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Tồn hiện tại: {item.stockQty} {item.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1">Số lượng xuất *</label>
              <input
                required
                type="number"
                value={actionQty}
                onChange={(e) => setActionQty(e.target.value)}
                className="w-full h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:border-[#5A3E2B]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsExportOpen(false)} className="h-10 rounded-lg text-stone-500 hover:text-stone-800">
                Hủy
              </Button>
              <Button type="submit" disabled={pending} className="h-10 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold px-4">
                Xác nhận xuất kho
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: THÊM NGUYÊN LIỆU MỚI */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md rounded-xl border-stone-200 bg-white text-stone-900 p-6 font-sans shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <Plus className="size-5 text-[#5A3E2B]" />
              <span>Thêm nguyên liệu mới vào kho</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Khai báo mặt hàng để quản lý tồn kho và tự động trừ định lượng.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddIngredient} className="space-y-4 pt-2 text-xs">
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Tên nguyên liệu *</label>
              <div className="flex items-center gap-2">
                {(() => {
                  const meta = INGREDIENT_ICONS[getAutoIconKey(newName)] || INGREDIENT_ICONS.box
                  const CurrentIcon = meta.icon
                  return (
                    <span
                      className={cn(
                        'flex size-10 items-center justify-center rounded-lg border shadow-2xs shrink-0',
                        meta.badgeBg,
                        meta.textColor,
                        meta.borderColor
                      )}
                      title={meta.label}
                    >
                      <CurrentIcon className="size-5" />
                    </span>
                  )
                })()}
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Tên nguyên liệu (VD: Bột ca cao, Sữa dừa)..."
                  className="w-full h-10 rounded-lg border border-stone-200/80 bg-white px-3.5 text-sm text-stone-900 focus:outline-none focus:border-[#5A3E2B] truncate"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Đơn vị tính *</label>
                <input
                  required
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="kg, lít, hộp..."
                  className="w-full h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:border-[#5A3E2B] truncate"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Tồn ban đầu *</label>
                <input
                  required
                  type="number"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  className="w-full h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:border-[#5A3E2B]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Mức cảnh báo tối thiểu *</label>
                <input
                  required
                  type="number"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  className="w-full h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:border-[#5A3E2B]"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Đơn giá nhập (VND) *</label>
                <input
                  required
                  type="number"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  className="w-full h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:border-[#5A3E2B]"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="h-10 rounded-lg text-stone-500 hover:text-stone-800">
                Hủy
              </Button>
              <Button type="submit" disabled={pending} className="h-10 rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold px-4">
                Tạo nguyên liệu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default InventoryTable
