import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { MetricProgressBar } from '@/components/admin/fulfillment-progress'
import { cn } from '@/lib/utils'

type MetricCardProps = {
  label: React.ReactNode
  value: string
  icon: LucideIcon
  trend?: number
  invertTrend?: boolean
  footnote: React.ReactNode
  progress?: {
    value: number
    label?: string
  }
}

export function MetricCard({ label, value, icon: Icon, trend, invertTrend, footnote, progress }: MetricCardProps) {
  const good = trend === undefined ? true : invertTrend ? trend <= 0 : trend >= 0
  const TrendIcon = trend !== undefined && trend < 0 ? TrendingDown : TrendingUp
  return (
    <div className="relative overflow-hidden rounded-xl border border-stone-200/90 bg-white p-6 md:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 hover:border-amber-300 hover:shadow-md flex flex-col justify-between gap-5 min-h-[220px] text-stone-900">
      <div className="flex items-center justify-between gap-3">
        <span className="text-base md:text-lg font-semibold tracking-tight text-stone-500">
          {label}
        </span>
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-[#F9F7F4] text-[#5A3E2B] shadow-2xs border border-stone-200/90">
          <Icon className="size-6" aria-hidden="true" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <span className="text-4xl md:text-5xl font-extrabold tracking-tight tabular-nums text-stone-900">
            {value}
          </span>
          {trend !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs md:text-sm font-bold border',
                good
                  ? 'border-emerald-300/80 bg-emerald-50/90 text-emerald-900'
                  : 'border-amber-300/80 bg-amber-50/90 text-amber-950'
              )}
            >
              <TrendIcon className="size-4 shrink-0 inline" />
              {trend > 0 ? '+' : ''}
              {trend}%
            </span>
          )}
        </div>
        {progress && <MetricProgressBar value={progress.value} label={progress.label} />}
      </div>

      <div className="text-xs md:text-sm text-stone-500 font-medium pt-3 border-t border-stone-100">
        {footnote}
      </div>
    </div>
  )
}
export default MetricCard
