'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Check, ChevronDown, Sparkles, TicketPercent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMoneyVND } from '@/lib/store/cart-store'
import {
  rankStorefrontVouchers,
  voucherBenefitSummary,
  type ActiveVoucher,
} from '@/lib/storefront/vouchers'

export interface VoucherPickerInputProps {
  value: string
  onChange: (value: string) => void
  onApply: (code: string) => Promise<void> | void
  subtotal: number
  appliedCode?: string | null
  disabled?: boolean
}

const fetcher = async (url: string): Promise<{ vouchers: ActiveVoucher[] }> => {
  const res = await fetch(url)
  if (!res.ok) return { vouchers: [] }
  return res.json()
}

export function VoucherPickerInput({
  value,
  onChange,
  onApply,
  subtotal,
  appliedCode,
  disabled = false,
}: VoucherPickerInputProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { data, isLoading, mutate } = useSWR<{ vouchers: ActiveVoucher[] }>(
    '/api/vouchers/available',
    fetcher,
    { revalidateOnFocus: false }
  )

  const vouchers = data?.vouchers ?? []
  const ranked = rankStorefrontVouchers(vouchers, subtotal)
  const normalizedApplied = appliedCode?.trim().toUpperCase() || null

  useEffect(() => {
    if (!open) return
    function handleOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      void mutate()
    }
  }

  const handleApplyCurrent = async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    setOpen(false)
    await onApply(trimmed)
  }

  const handleSelectVoucher = async (code: string) => {
    onChange(code)
    setOpen(false)
    await onApply(code)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="promo-form flex gap-2">
        <div className="relative flex-1 min-w-0">
          <input
            aria-label="Mã giảm giá"
            placeholder="Nhập mã ưu đãi"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleApplyCurrent()
              }
            }}
            disabled={disabled}
            className="w-full rounded-xl border border-stone-200/80 bg-white pl-3.5 pr-9 py-2 text-xs text-stone-900 placeholder:text-stone-400 uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[#3E2723] truncate disabled:opacity-50"
          />
          <button
            type="button"
            aria-label="Chọn mã ưu đãi khả dụng"
            aria-expanded={open}
            disabled={disabled}
            onClick={handleToggle}
            title="Xem danh sách voucher có thể dùng"
            className="absolute inset-y-1 right-1 flex size-7 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-[#3E2723] transition-colors cursor-pointer disabled:opacity-50"
          >
            <ChevronDown
              className={`size-4 transition-transform duration-200 ${
                open ? 'rotate-180 text-[#3E2723]' : ''
              }`}
            />
          </button>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={disabled || !value.trim()}
          onClick={() => void handleApplyCurrent()}
          className="rounded-xl border-stone-300 text-[#3E2723] text-xs font-semibold hover:bg-stone-100 cursor-pointer shrink-0"
        >
          Áp dụng
        </Button>
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Danh sách voucher khả dụng"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl space-y-1.5"
        >
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-stone-500 border-b border-stone-100">
            <span className="flex items-center gap-1.5 text-stone-700">
              <TicketPercent className="size-3.5 text-amber-700" />
              Voucher tài khoản có thể dùng
            </span>
            <span className="tabular-nums">{ranked.length} mã</span>
          </div>

          {isLoading ? (
            <p className="py-4 text-center text-xs text-stone-500">Đang tải danh sách voucher...</p>
          ) : ranked.length === 0 ? (
            <p className="py-4 px-2 text-center text-xs text-stone-500">
              Hiện chưa có voucher khả dụng cho tài khoản của bạn.
            </p>
          ) : (
            ranked.map((item) => {
              const summary = voucherBenefitSummary(item.voucher)
              const isSelected = normalizedApplied === item.voucher.code
              return (
                <button
                  key={item.voucher.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectVoucher(item.voucher.code)}
                  className={`w-full text-left rounded-xl border p-2.5 transition-all cursor-pointer ${
                    item.isBest
                      ? 'border-amber-300 bg-amber-50/60 hover:bg-amber-100/60'
                      : isSelected
                      ? 'border-emerald-300 bg-emerald-50/40'
                      : 'border-stone-200/70 bg-white hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-extrabold tracking-wider text-[#3E2723]">
                      {item.voucher.code}
                      {isSelected && <Check className="size-3.5 text-emerald-600" />}
                    </span>

                    {item.isBest ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                        <Sparkles className="size-2.5 text-amber-700" />
                        Giảm nhiều nhất · -{formatMoneyVND(item.discount)}
                      </span>
                    ) : item.eligible && item.discount > 0 ? (
                      <span className="text-[11px] font-bold text-emerald-700 tabular-nums">
                        -{formatMoneyVND(item.discount)}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 text-[11px] font-semibold text-stone-700">
                    {summary.discountText}
                    {summary.minOrderText ? ` · ${summary.minOrderText}` : ''}
                  </p>

                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-stone-500">
                    <span>{summary.expiryText}</span>
                    {!item.eligible && item.shortfall > 0 && (
                      <span className="font-semibold text-amber-700">
                        Mua thêm {formatMoneyVND(item.shortfall)}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
