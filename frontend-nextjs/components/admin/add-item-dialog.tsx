'use client'

import { useState, useTransition } from 'react'
import { ImageIcon, Plus, X } from 'lucide-react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { createMenuItem } from '@/app/admin/actions'

type Option = { id: number; name: string; price: string }

export function AddItemDialog({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'menu' | 'ingredient'>('menu')
  const [imageUrl, setImageUrl] = useState('')
  const [options, setOptions] = useState<Option[]>([])
  const [pending, startTransition] = useTransition()

  function reset() {
    setKind('menu')
    setImageUrl('')
    setOptions([])
  }

  function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const num = (key: string) => Number(data.get(key) || 0)
    startTransition(async () => {
      const result = await createMenuItem({
        name: String(data.get('name') ?? ''),
        category: String(data.get('category') ?? ''),
        kind,
        stockQty: num('stockQty'),
        unit: String(data.get('unit') ?? ''),
        lowStockThreshold: num('lowStockThreshold'),
        costPrice: num('costPrice'),
        sellPrice: kind === 'menu' ? num('sellPrice') : 0,
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
      <DialogTrigger render={<Button className="bg-[#3E2723] hover:bg-[#4A3525] text-white font-semibold" />}>
        <Plus data-icon="inline-start" />
        Thêm món mới
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-stone-900">Thêm mặt hàng mới</DialogTitle>
          <DialogDescription className="text-stone-600">Tạo món bán trên thực đơn POS hoặc theo dõi nguyên vật liệu thô.</DialogDescription>
        </DialogHeader>
        <form
          id="add-item-form"
          onSubmit={(event) => {
            event.preventDefault()
            submit(event.currentTarget)
          }}
        >
          <ScrollArea className="max-h-[60svh]">
            <FieldGroup className="pr-3">
              <ToggleGroup value={[kind]} onValueChange={(value) => value[0] && setKind(value[0] as 'menu' | 'ingredient')} variant="outline" className="w-full" aria-label="Loại mặt hàng">
                <ToggleGroupItem value="menu" className="flex-1 font-semibold">Món bán</ToggleGroupItem>
                <ToggleGroupItem value="ingredient" className="flex-1 font-semibold">Nguyên liệu</ToggleGroupItem>
              </ToggleGroup>

              <div className="flex items-start gap-4">
                <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50 text-stone-400">
                  {imageUrl ? <img src={imageUrl} alt="Xem trước" className="size-full object-cover" /> : <ImageIcon aria-hidden="true" />}
                </div>
                <Field className="flex-1">
                  <FieldLabel htmlFor="item-image" className="text-stone-700 font-semibold">Đường dẫn hình ảnh</FieldLabel>
                  <Input id="item-image" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="/images/latte.png" />
                  <FieldDescription className="text-stone-500">Nhập liên kết hình ảnh https hoặc đường dẫn nội bộ.</FieldDescription>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="item-name" className="text-stone-700 font-semibold">Tên món</FieldLabel>
                  <Input id="item-name" name="name" required maxLength={80} placeholder="Ví dụ: Cà phê Muối" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="item-category" className="text-stone-700 font-semibold">Phân loại</FieldLabel>
                  <Input id="item-category" name="category" required list="item-categories" maxLength={40} placeholder="Cà phê, Bánh ngọt..." />
                  <datalist id="item-categories">
                    {categories.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </Field>
                <Field>
                  <FieldLabel htmlFor="item-stock" className="text-stone-700 font-semibold">Số lượng tồn ban đầu</FieldLabel>
                  <Input id="item-stock" name="stockQty" type="number" min="0" step="0.01" required placeholder="50" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="item-unit" className="text-stone-700 font-semibold">Đơn vị tính</FieldLabel>
                  <Input id="item-unit" name="unit" placeholder={kind === 'menu' ? 'ly' : 'kg'} maxLength={12} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="item-threshold" className="text-stone-700 font-semibold">Ngưỡng báo sắp hết</FieldLabel>
                  <Input id="item-threshold" name="lowStockThreshold" type="number" min="0" step="0.01" defaultValue="10" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="item-cost" className="text-stone-700 font-semibold">Giá vốn (VNĐ)</FieldLabel>
                  <Input id="item-cost" name="costPrice" type="number" min="0" step="1000" required placeholder="20000" />
                </Field>
                {kind === 'menu' && (
                  <Field>
                    <FieldLabel htmlFor="item-price" className="text-stone-700 font-semibold">Giá bán (VNĐ)</FieldLabel>
                    <Input id="item-price" name="sellPrice" type="number" min="0" step="1000" required placeholder="45000" />
                  </Field>
                )}
              </div>

              {kind === 'menu' && (
                <>
                  <Field>
                    <FieldLabel htmlFor="item-recipe" className="text-stone-700 font-semibold">Công thức định lượng</FieldLabel>
                    <Textarea id="item-recipe" name="recipe" placeholder="20g bột cà phê, 40ml sữa đặc, 30ml kem muối..." maxLength={1000} />
                  </Field>
                  <FieldSet>
                    <FieldLegend variant="label" className="text-stone-700 font-semibold">Biến thể / Kích cỡ phụ thu</FieldLegend>
                    <FieldDescription className="text-stone-500">Các tùy chọn size hoặc topping kèm phí thêm.</FieldDescription>
                    <div className="flex flex-col gap-2">
                      {options.map((option) => (
                        <div key={option.id} className="flex items-center gap-2">
                          <Input
                            aria-label="Tên biến thể"
                            placeholder="Size Lớn"
                            value={option.name}
                            onChange={(event) =>
                              setOptions((current) => current.map((entry) => (entry.id === option.id ? { ...entry, name: event.target.value } : entry)))
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
                              setOptions((current) => current.map((entry) => (entry.id === option.id ? { ...entry, price: event.target.value } : entry)))
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
                        className="self-start font-semibold"
                        onClick={() => setOptions((current) => [...current, { id: Date.now(), name: '', price: '' }])}
                      >
                        <Plus data-icon="inline-start" />
                        Thêm tùy chọn
                      </Button>
                    </div>
                  </FieldSet>
                </>
              )}
            </FieldGroup>
          </ScrollArea>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Hủy bỏ
          </Button>
          <Button type="submit" form="add-item-form" disabled={pending} className="bg-[#3E2723] hover:bg-[#4A3525] text-white font-semibold">
            {pending && <Spinner data-icon="inline-start" />}
            Lưu mặt hàng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
