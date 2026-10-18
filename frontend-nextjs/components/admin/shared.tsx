'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { statusLabels } from '@/lib/admin/format'
import type { OrderStatus } from '@/lib/db/schema'

export function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [router, intervalMs])
  return null
}

const statusStyles: Record<OrderStatus, { badge: string; dot: string }> = {
  pending: { badge: 'border-amber-300/80 bg-amber-50/90 text-amber-950 font-bold', dot: 'bg-amber-600' },
  brewing: { badge: 'border-blue-300/80 bg-blue-50/90 text-blue-950 font-bold', dot: 'bg-blue-600' },
  ready: { badge: 'border-emerald-300/80 bg-emerald-50/90 text-emerald-900 font-bold', dot: 'bg-emerald-600' },
  completed: { badge: 'border-stone-300/80 bg-stone-100/90 text-stone-900 font-bold', dot: 'bg-stone-500' },
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = statusStyles[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap', config.badge)}>
      <span className={cn('size-1.5 rounded-full', config.dot)} aria-hidden="true" />
      {statusLabels[status]}
    </span>
  )
}

// Marks a screen or widget that only demonstrates the interface: its data is sample data and its
// actions are not saved anywhere, so nobody mistakes it for a working feature.
export function DemoNotice({ children, compact = false }: { children?: React.ReactNode; compact?: boolean }) {
  if (compact) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
        Bản demo
      </span>
    )
  }
  return (
    <div role="note" className="flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
      <span className="mt-0.5 shrink-0 rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">Bản demo</span>
      <p className="leading-relaxed">
        {children ?? 'Màn hình này dùng dữ liệu minh hoạ. Các thao tác chỉ hiển thị trong trình duyệt và không được lưu vào hệ thống.'}
      </p>
    </div>
  )
}

export function PageHeading({ title, description, children }: { title: React.ReactNode; description: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between py-1">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-stone-900 text-balance">{title}</h1>
        <p className="text-base md:text-lg text-stone-600 font-medium text-pretty">{description}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  )
}
