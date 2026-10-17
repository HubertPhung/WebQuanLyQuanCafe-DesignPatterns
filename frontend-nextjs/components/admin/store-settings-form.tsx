'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateStoreSettings } from '@/app/admin/actions'
import type { StoreConfig } from '@/lib/api-client'

type Field = {
  key: 'storeName' | 'storeAddress' | 'storePhone' | 'openingTime' | 'closingTime' | 'maxReservationGuests' | 'loyaltyRateVndPerPoint' | 'pointRedeemValueVnd'
  label: string
  type: 'text' | 'time' | 'number'
  hint?: string
}

const fields: Field[] = [
  { key: 'storeName', label: 'Tên quán', type: 'text' },
  { key: 'storeAddress', label: 'Địa chỉ', type: 'text' },
  { key: 'storePhone', label: 'Số điện thoại', type: 'text' },
  { key: 'openingTime', label: 'Giờ mở cửa', type: 'time', hint: 'Phiếu đặt bàn ngoài giờ bị chuỗi kiểm định từ chối' },
  { key: 'closingTime', label: 'Giờ đóng cửa', type: 'time' },
  { key: 'maxReservationGuests', label: 'Số khách tối đa mỗi phiếu', type: 'number' },
  { key: 'loyaltyRateVndPerPoint', label: 'Số tiền cho 1 điểm (đ)', type: 'number', hint: 'Mặc định 10.000 đ = 1 điểm' },
  { key: 'pointRedeemValueVnd', label: 'Giá trị 1 điểm khi đổi (đ)', type: 'number', hint: 'Mặc định 1 điểm = 1.000 đ' },
]

// Edits the SystemConfigManager Singleton through PUT /api/config (ADMIN).
export function StoreSettingsForm({ config }: { config: StoreConfig | null }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((field) => [field.key, config ? String(config[field.key]) : ''])),
  )
  const [pending, startTransition] = useTransition()

  if (!config) {
    return (
      <p role="status" className="text-sm text-stone-600">
        Máy chủ Java không phản hồi, nên chưa đọc hoặc sửa được thông số vận hành. Thử lại khi máy chủ chạy.
      </p>
    )
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const change = Object.fromEntries(
        fields.map((field) => [field.key, field.type === 'number' ? Number(values[field.key]) : values[field.key].trim()]),
      )
      const result = await updateStoreSettings(change)
      if (result.ok) toast.success('Đã lưu cài đặt', { description: result.message })
      else toast.error(result.error)
    })
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <Label htmlFor={`setting-${field.key}`} className="text-stone-700">
            {field.label}
          </Label>
          <Input
            id={`setting-${field.key}`}
            type={field.type}
            inputMode={field.type === 'number' ? 'numeric' : undefined}
            value={values[field.key]}
            onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
            required
          />
          {field.hint && <span className="text-xs text-stone-500">{field.hint}</span>}
        </div>
      ))}
      <p className="text-xs text-stone-500 sm:col-span-2">
        VAT {Math.round(config.vatRate * 100)}% và thời gian tự huỷ {config.autoCancelMinutes} phút chỉ để tham khảo: đơn hàng dùng VAT
        cố định trong code và chưa có tác vụ tự huỷ. Thay đổi được giữ trong bộ nhớ máy chủ Java và trở về mặc định khi máy chủ khởi động lại.
      </p>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang lưu...' : 'Lưu cài đặt'}
        </Button>
      </div>
    </form>
  )
}
