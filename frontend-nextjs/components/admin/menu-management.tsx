'use client'

import { useState } from 'react'
import {
  Coffee,
  Edit,
  FolderPlus,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  UtensilsCrossed,
  X,
  Tag,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface MenuItemType {
  id: number
  name: string
  category: string
  price: number
  description: string
  imageUrl?: string
  inStock: boolean
}

interface CategoryType {
  id: number
  name: string
  description: string
  itemCount: number
}

const initialItems: MenuItemType[] = [
  { id: 1, name: 'Cà phê Muối Đặc Biệt', category: 'Cà phê', price: 45000, description: 'Cà phê pha phin truyền thống kết hợp lớp kem mặn béo ngậy thơm ngon.', inStock: true },
  { id: 2, name: 'Cà phê Latte Vani Mịn', category: 'Cà phê', price: 55000, description: 'Double shot espresso, siro vani ngọt thanh và sữa tươi đánh bông mịn.', inStock: true },
  { id: 3, name: 'Bạc Xỉu Sữa Tươi Sài Gòn', category: 'Cà phê', price: 45000, description: 'Nhiều sữa ít cà phê, béo ngậy thơm mát chuẩn phong vị xưa.', inStock: true },
  { id: 4, name: 'Cold Brew Cam Vàng', category: 'Cà phê ủ lạnh', price: 55000, description: 'Cà phê ủ lạnh 20 tiếng kết hợp lát cam vàng mọng nước và mật ong rừng.', inStock: true },
  { id: 5, name: 'Nước cam tươi nguyên chất', category: 'Nước ép', price: 45000, description: 'Cam sành tươi vắt nguyên chất bổ sung vitamin C tức thì.', inStock: true },
  { id: 6, name: 'Bánh Croissant bơ Pháp', category: 'Bánh ngọt', price: 45000, description: 'Bánh sừng bò ngàn lớp bơ Pháp nướng giòn rụm thơm lừng mỗi sáng.', inStock: true },
  { id: 7, name: 'Cơm chiên hoàng bào', category: 'Món nóng', price: 65000, description: 'Cơm chiên hạt ngọc giòn tơi kèm lạp xưởng tôm tươi đậm vị.', inStock: true },
  { id: 8, name: 'Bánh mì thịt xông khói giòn', category: 'Món nóng', price: 40000, description: 'Bánh mì truyền thống kẹp thịt xông khói pate thủ công và dưa leo rau thơm.', inStock: true },
]

const initialCategories: CategoryType[] = [
  { id: 1, name: 'Cà phê', description: 'Các món cà phê pha máy espresso và phin truyền thống', itemCount: 3 },
  { id: 2, name: 'Cà phê ủ lạnh', description: 'Cà phê chiết xuất lạnh chậm 20h mượt mà thanh khiết', itemCount: 1 },
  { id: 3, name: 'Nước ép', description: 'Nước ép trái cây tươi ngon lành không thêm đường', itemCount: 1 },
  { id: 4, name: 'Bánh ngọt', description: 'Bánh nướng mới mỗi sáng chuẩn thợ bánh Pháp', itemCount: 1 },
  { id: 5, name: 'Món nóng', description: 'Các món điểm tâm sáng và món ăn nhẹ tại quán', itemCount: 2 },
]

export function MenuManagement() {
  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items')
  const [items, setItems] = useState<MenuItemType[]>(initialItems)
  const [categories, setCategories] = useState<CategoryType[]>(initialCategories)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Modals
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)

  // Form states
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('Cà phê')
  const [newItemPrice, setNewItemPrice] = useState('45000')
  const [newItemDesc, setNewItemDesc] = useState('')

  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim()) {
      toast.error('Vui lòng nhập tên món')
      return
    }
    const item: MenuItemType = {
      id: Date.now(),
      name: newItemName.trim(),
      category: newItemCategory,
      price: Number(newItemPrice) || 35000,
      description: newItemDesc.trim() || 'Món mới được thêm vào thực đơn.',
      inStock: true,
    }
    setItems([item, ...items])
    setIsAddItemOpen(false)
    setNewItemName('')
    setNewItemDesc('')
    toast.success(`Đã thêm món "${item.name}" vào thực đơn!`)
  }

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) {
      toast.error('Vui lòng nhập tên danh mục')
      return
    }
    const cat: CategoryType = {
      id: Date.now(),
      name: newCatName.trim(),
      description: newCatDesc.trim() || 'Danh mục món ăn đồ uống mới.',
      itemCount: 0,
    }
    setCategories([...categories, cat])
    setIsAddCategoryOpen(false)
    setNewCatName('')
    setNewCatDesc('')
    toast.success(`Đã tạo danh mục "${cat.name}"!`)
  }

  const handleDeleteItem = (id: number, name: string) => {
    setItems(items.filter((item) => item.id !== id))
    toast.success(`Đã xóa món "${name}" khỏi thực đơn`)
  }

  const handleDeleteCategory = (id: number, name: string) => {
    setCategories(categories.filter((c) => c.id !== id))
    toast.success(`Đã xóa danh mục "${name}"`)
  }

  const filteredItems = items.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.category.toLowerCase().includes(search.toLowerCase())
    const matchCat = selectedCategory === 'all' || item.category === selectedCategory
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-6 font-sans text-stone-900">
      {/* Tab Switcher & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200/50">
        <div className="flex items-center gap-1.5 rounded-lg bg-stone-100/90 border border-stone-200/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer',
              activeTab === 'items'
                ? 'bg-[#5A3E2B] text-white shadow-xs'
                : 'text-stone-700 hover:text-stone-950'
            )}
          >
            <UtensilsCrossed className="size-4" />
            <span>Món ăn & Thức uống ({items.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer',
              activeTab === 'categories'
                ? 'bg-[#5A3E2B] text-white shadow-xs'
                : 'text-stone-700 hover:text-stone-950'
            )}
          >
            <Tag className="size-4" />
            <span>Danh mục món ({categories.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => setIsAddItemOpen(true)}
            className="h-10 rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold text-xs md:text-sm px-4 gap-2 cursor-pointer shadow-xs"
          >
            <Plus className="size-4 stroke-[2.5]" />
            <span>+ Thêm món mới</span>
          </Button>
          <Button
            onClick={() => setIsAddCategoryOpen(true)}
            variant="outline"
            className="h-10 rounded-lg border-stone-200/80 bg-white hover:bg-stone-50 text-stone-800 text-xs md:text-sm px-4 gap-2 cursor-pointer shadow-xs"
          >
            <FolderPlus className="size-4 text-[#5A3E2B]" />
            <span>+ Thêm danh mục</span>
          </Button>
        </div>
      </div>

      {/* TAB 1: MÓN ĂN & THỨC UỐNG */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md min-w-0">
              <Search className="absolute left-3.5 top-3 size-4 text-stone-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm món ăn, thức uống..."
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-stone-200/80 bg-white text-xs md:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#5A3E2B] shadow-2xs truncate"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-stone-600 font-semibold whitespace-nowrap">Danh mục:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-xs md:text-sm text-stone-800 focus:outline-none focus:border-[#5A3E2B] cursor-pointer shadow-2xs truncate max-w-[180px]"
              >
                <option value="all">Tất cả danh mục</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded-xl border border-stone-200/80 bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-stone-200/80 bg-stone-50/60 text-stone-500 font-semibold uppercase tracking-wider text-xs">
                    <th className="py-3 px-3">Ảnh món</th>
                    <th className="py-3 px-3">Tên món</th>
                    <th className="py-3 px-3">Danh mục</th>
                    <th className="py-3 px-3">Đơn giá</th>
                    <th className="py-3 px-3">Mô tả tóm tắt</th>
                    <th className="py-3 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-3">
                        <div className="size-11 rounded-md bg-[#F7F5F0] border border-stone-200/80 flex items-center justify-center text-[#5A3E2B] font-bold">
                          <Coffee className="size-4.5" />
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold text-stone-900">
                        <span>{item.name}</span>
                        {item.inStock && (
                          <Badge className="ml-2 bg-emerald-50/90 text-emerald-900 border-emerald-300 font-bold text-[10px] rounded-full px-2.5 py-0.5">
                            Đang bán
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-800 border border-stone-200">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-extrabold text-[#5A3E2B] tabular-nums">
                        {item.price.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-3 text-xs text-stone-500 max-w-xs truncate">
                        {item.description}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 rounded-md border-stone-200/80 bg-white hover:bg-stone-50 text-stone-700 text-xs gap-1 shadow-2xs"
                            onClick={() => toast.info(`Chỉnh sửa món ${item.name}`)}
                          >
                            <Edit className="size-3.5" />
                            <span>Sửa</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 rounded-md border-stone-200/80 bg-white text-stone-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 shadow-2xs"
                            onClick={() => handleDeleteItem(item.id, item.name)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DANH MỤC MÓN */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-stone-200/80 bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-stone-200/80 bg-stone-50/60 text-stone-500 font-semibold uppercase tracking-wider text-xs">
                    <th className="py-3 px-3">ID</th>
                    <th className="py-3 px-3">Tên danh mục</th>
                    <th className="py-3 px-3">Mô tả phân loại</th>
                    <th className="py-3 px-3 text-center">Số lượng món</th>
                    <th className="py-3 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3.5 px-3 font-mono font-bold text-stone-400">#{c.id}</td>
                      <td className="py-3.5 px-3 font-bold text-stone-900 flex items-center gap-2">
                        <Tag className="size-4 text-[#5A3E2B]" />
                        <span>{c.name}</span>
                      </td>
                      <td className="py-3.5 px-3 text-xs text-stone-500 max-w-sm">{c.description}</td>
                      <td className="py-3.5 px-3 text-center">
                        <Badge className="bg-stone-100 text-stone-800 border-stone-200 tabular-nums font-bold rounded-full px-2.5 py-0.5">
                          {c.itemCount} món
                        </Badge>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 rounded-md border-stone-200/80 bg-white hover:bg-stone-50 text-stone-700 text-xs gap-1 shadow-2xs"
                            onClick={() => toast.info(`Chỉnh sửa danh mục ${c.name}`)}
                          >
                            <Edit className="size-3.5" />
                            <span>Sửa</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 rounded-md border-stone-200/80 bg-white text-stone-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 shadow-2xs"
                            onClick={() => handleDeleteCategory(c.id, c.name)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: THÊM MÓN MỚI */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="max-w-lg rounded-xl border-stone-200 bg-white text-stone-900 p-6 font-sans shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <UtensilsCrossed className="size-5 text-[#5A3E2B]" />
              <span>Thêm món mới vào thực đơn</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Nhập thông tin chi tiết và định giá để hiển thị trên cả POS và giao diện khách hàng.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddItem} className="space-y-4 pt-2 text-xs">
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Tên món *</label>
              <input
                required
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Tên món (VD: Cà phê Muối)..."
                className="w-full h-10 rounded-lg border border-stone-200/80 bg-white px-3.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#5A3E2B] truncate"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Danh mục *</label>
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-800 focus:outline-none focus:border-[#5A3E2B] truncate"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Giá bán (VND) *</label>
                <input
                  required
                  type="number"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  placeholder="35000"
                  className="w-full h-10 rounded-lg border border-stone-200/80 bg-white px-3.5 text-sm text-stone-900 tabular-nums focus:outline-none focus:border-[#5A3E2B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1">Mô tả hương vị món</label>
              <textarea
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
                rows={2}
                placeholder="Mô tả hương vị, thành phần đặc trưng..."
                className="w-full rounded-lg border border-stone-200/80 bg-white p-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#5A3E2B]"
              />
            </div>

            {/* Khung kéo thả ảnh */}
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Ảnh món ăn (Hỗ trợ JPG, PNG, WebP)</label>
              <div className="border-2 border-dashed border-stone-200/80 rounded-lg p-4 text-center hover:border-[#5A3E2B]/50 transition-colors cursor-pointer bg-stone-50/60">
                <UploadCloud className="size-8 text-stone-400 mx-auto mb-1.5" />
                <p className="text-xs text-stone-700 font-medium">Kéo thả ảnh vào đây hoặc nhấp để chọn tệp</p>
                <p className="text-[10px] text-stone-400 mt-0.5">Kích thước tối đa 5MB</p>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAddItemOpen(false)}
                className="h-10 rounded-lg text-stone-500 hover:text-stone-900"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                className="h-10 rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold text-xs px-5 shadow-xs"
              >
                Xác nhận thêm món
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: THÊM DANH MỤC */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="max-w-md rounded-xl border-stone-200 bg-white text-stone-900 p-6 font-sans shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <FolderPlus className="size-5 text-[#5A3E2B]" />
              <span>Thêm danh mục mới</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Tạo danh mục mới để phân loại và sắp xếp đồ uống, thức ăn.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddCategory} className="space-y-4 pt-2 text-xs">
            <div>
              <label className="block text-stone-700 font-semibold mb-1">Tên danh mục *</label>
              <input
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Tên danh mục (VD: Trà hoa quả)..."
                className="w-full h-10 rounded-lg border border-stone-200/80 bg-white px-3.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#5A3E2B] truncate"
              />
            </div>

            <div>
              <label className="block text-stone-700 font-semibold mb-1">Mô tả danh mục</label>
              <textarea
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                rows={2}
                placeholder="Mô tả nhóm món này..."
                className="w-full rounded-lg border border-stone-200/80 bg-white p-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#5A3E2B]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAddCategoryOpen(false)}
                className="h-10 rounded-lg text-stone-500 hover:text-stone-900"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                className="h-10 rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold text-xs px-5 shadow-xs"
              >
                Tạo danh mục
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default MenuManagement
