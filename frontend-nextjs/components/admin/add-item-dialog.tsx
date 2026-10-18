'use client'

import { useState, useTransition, useRef } from 'react'
import {
  Check,
  ImageIcon,
  ImagePlus,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { createMenuItem } from '@/app/admin/actions'
import { cn } from '@/lib/utils'

type Option = { id: number; name: string; price: string }

const SAMPLE_PRESETS = [
  { name: 'Cà phê Latte', url: '/images/latte.png' },
  { name: 'Cold Brew', url: '/images/cold-brew.png' },
  { name: 'Bánh Croissant', url: '/images/croissant.png' },
  { name: 'Hạt Arabica', url: '/images/beans.png' },
]

export function AddItemDialog({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState(false)
  const kind = 'menu' as const
  const [imageUrl, setImageUrl] = useState('')
  const [imageName, setImageName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [options, setOptions] = useState<Option[]>([])
  const [pending, startTransition] = useTransition()

  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setImageUrl('')
    setImageName('')
    setOptions([])
    setIsDragging(false)
  }

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn một file hình ảnh hợp lệ (PNG, JPG, WEBP).')
      return
    }

    setImageName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const src = event.target?.result as string
      if (!src) return

      const img = new Image()
      img.onload = () => {
        const maxWidth = 800
        const maxHeight = 800
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85)
          setImageUrl(compressedDataUrl)
          toast.success(`Đã tải ảnh "${file.name}" thành công!`)
        } else {
          setImageUrl(src)
        }
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processImageFile(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processImageFile(file)
    }
  }

  function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const num = (key: string) => Number(data.get(key) || 0)
    startTransition(async () => {
      const result = await createMenuItem({
        name: String(data.get('name') ?? ''),
        category: String(data.get('category') ?? ''),
        kind,
        unit: String(data.get('unit') ?? '') || 'ly',
        costPrice: num('costPrice'),
        sellPrice: num('sellPrice'),
        recipe: String(data.get('recipe') ?? ''),
        imageUrl,
        variations: options.map((option) => ({ name: option.name, price: Number(option.price || 0) })),
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      reset()
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-[#3E2723] hover:bg-[#4A3525] text-white font-semibold cursor-pointer" />}>
        <Plus data-icon="inline-start" />
        Thêm món mới
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col bg-white p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl">
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-stone-100 shrink-0">
          <DialogTitle className="text-xl font-bold text-stone-900">Thêm món mới vào thực đơn</DialogTitle>
          <DialogDescription className="text-stone-600 text-xs sm:text-sm">
            Tạo món ăn, thức uống phục vụ trên thực đơn quán và quầy thu ngân POS.
          </DialogDescription>
        </DialogHeader>

        <form
          id="add-item-form"
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault()
            submit(event.currentTarget)
          }}
        >
          {/* Scrollable form body */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* UPLOAD HÌNH ẢNH: KÉO THẢ HOẶC CHỌN TỪ MÁY TÍNH */}
            <div className="space-y-2">
              <label className="block text-xs sm:text-sm font-semibold text-stone-800">
                Hình ảnh món ăn / đồ uống <span className="text-stone-400 font-normal">(kéo thả hoặc chọn từ máy tính)</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />

              {!imageUrl ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'group relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer',
                    isDragging
                      ? 'border-[#5A3E2B] bg-[#5A3E2B]/10 ring-4 ring-[#5A3E2B]/15 scale-[1.01]'
                      : 'border-stone-300 bg-stone-50/60 hover:border-[#5A3E2B] hover:bg-stone-50'
                  )}
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-white border border-stone-200 text-[#5A3E2B] shadow-xs group-hover:scale-110 transition-transform">
                    <UploadCloud className="size-6 text-[#5A3E2B]" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-stone-800">
                      Kéo thả ảnh vào đây hoặc{' '}
                      <span className="text-[#5A3E2B] underline font-bold">chọn file từ máy tính</span>
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Hỗ trợ PNG, JPG, WEBP (Tự động nén tối ưu hiển thị)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 rounded-xl border border-stone-200 bg-stone-50/80 p-3">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xs">
                    <img src={imageUrl} alt="Xem trước món" className="size-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                      <Check className="size-3.5 text-emerald-600" />
                      <span>Ảnh đã chọn sẵn sàng</span>
                    </div>
                    <p className="truncate text-[11px] text-stone-500 mt-0.5 font-mono">
                      {imageName || 'Ảnh tùy chỉnh đã chọn'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-7 text-xs font-medium rounded-md gap-1"
                      >
                        <RefreshCw className="size-3" />
                        Đổi ảnh khác
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setImageUrl('')
                          setImageName('')
                        }}
                        className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md gap-1"
                      >
                        <Trash2 className="size-3" />
                        Xóa ảnh
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Ảnh mẫu có sẵn của quán */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-stone-500">Hoặc chọn ảnh mẫu:</span>
                {SAMPLE_PRESETS.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => {
                      setImageUrl(preset.url)
                      setImageName(preset.name)
                    }}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer',
                      imageUrl === preset.url
                        ? 'bg-[#5A3E2B] text-white border-[#5A3E2B]'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50 hover:border-stone-300'
                    )}
                  >
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CÁC TRƯỜNG THÔNG TIN MÓN */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="item-name" className="text-stone-700 font-semibold text-xs sm:text-sm">
                  Tên món *
                </FieldLabel>
                <Input id="item-name" name="name" required maxLength={80} placeholder="Ví dụ: Cà phê Muối" />
              </Field>

              <Field>
                <FieldLabel htmlFor="item-category" className="text-stone-700 font-semibold text-xs sm:text-sm">
                  Phân loại *
                </FieldLabel>
                <Input
                  id="item-category"
                  name="category"
                  required
                  list="item-categories"
                  maxLength={40}
                  placeholder="Cà phê, Bánh ngọt..."
                />
                <datalist id="item-categories">
                  {categories.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </Field>

              <Field>
                <FieldLabel htmlFor="item-unit" className="text-stone-700 font-semibold text-xs sm:text-sm">
                  Đơn vị tính *
                </FieldLabel>
                <Input
                  id="item-unit"
                  name="unit"
                  defaultValue="ly"
                  placeholder="ly, tách, phần..."
                  maxLength={12}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="item-cost" className="text-stone-700 font-semibold text-xs sm:text-sm">
                  Giá vốn (VNĐ) *
                </FieldLabel>
                <Input
                  id="item-cost"
                  name="costPrice"
                  type="number"
                  min="0"
                  step="1000"
                  required
                  placeholder="20000"
                />
              </Field>

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="item-price" className="text-stone-700 font-semibold text-xs sm:text-sm">
                  Giá bán (VNĐ) *
                </FieldLabel>
                <Input
                  id="item-price"
                  name="sellPrice"
                  type="number"
                  min="0"
                  step="1000"
                  required
                  placeholder="45000"
                />
              </Field>
            </div>

            {/* CÔNG THỨC ĐỊNH LƯỢNG */}
            <Field>
              <FieldLabel htmlFor="item-recipe" className="text-stone-700 font-semibold text-xs sm:text-sm">
                Công thức định lượng
              </FieldLabel>
              <Textarea
                id="item-recipe"
                name="recipe"
                rows={3}
                placeholder="20g bột cà phê, 40ml sữa đặc, 30ml kem muối..."
                maxLength={1000}
                className="min-h-[75px] resize-y"
              />
            </Field>

            {/* BIẾN THỂ / KÍCH CỠ PHỤ THU */}
            <FieldSet>
              <FieldLegend variant="label" className="text-stone-700 font-semibold text-xs sm:text-sm">
                Biến thể / Kích cỡ phụ thu
              </FieldLegend>
              <FieldDescription className="text-stone-500 text-xs">
                Các tùy chọn size hoặc topping kèm phí thêm (ví dụ: Size Lớn +10.000đ).
              </FieldDescription>
              <div className="flex flex-col gap-2 pt-1">
                {options.map((option) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <Input
                      aria-label="Tên biến thể"
                      placeholder="Size Lớn"
                      value={option.name}
                      onChange={(event) =>
                        setOptions((current) =>
                          current.map((entry) =>
                            entry.id === option.id ? { ...entry, name: event.target.value } : entry
                          )
                        )
                      }
                    />
                    <Input
                      aria-label="Phụ thu VNĐ"
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="10000"
                      className="w-28"
                      value={option.price}
                      onChange={(event) =>
                        setOptions((current) =>
                          current.map((entry) =>
                            entry.id === option.id ? { ...entry, price: event.target.value } : entry
                          )
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Xóa tùy chọn"
                      onClick={() => setOptions((current) => current.filter((entry) => entry.id !== option.id))}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start font-semibold cursor-pointer"
                  onClick={() => setOptions((current) => [...current, { id: Date.now(), name: '', price: '' }])}
                >
                  <Plus data-icon="inline-start" />
                  Thêm tùy chọn
                </Button>
              </div>
            </FieldSet>
          </div>

          {/* Fixed footer: Always neatly pinned at bottom, never overlapping */}
          <DialogFooter className="p-4 sm:px-6 border-t border-stone-200 bg-stone-50/90 shrink-0 m-0 flex sm:flex-row justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-lg cursor-pointer"
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="bg-[#3E2723] hover:bg-[#4A3525] text-white font-semibold rounded-lg cursor-pointer"
            >
              {pending && <Spinner data-icon="inline-start" />}
              Lưu món ăn
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AddItemDialog
