'use client'

import { motion } from 'framer-motion'
import type { OrderStatus } from '@/lib/db/schema'
import { cn } from '@/lib/utils'

export const fulfillmentConfig: Record<
  OrderStatus,
  {
    percent: number
    label: string
    dotColor: string
    gradient: string
    step: number
  }
> = {
  pending: {
    percent: 25,
    label: 'Order Placed',
    dotColor: 'bg-amber-500',
    gradient: 'from-amber-500 to-amber-400',
    step: 1,
  },
  brewing: {
    percent: 60,
    label: 'Brewing',
    dotColor: 'bg-blue-500',
    gradient: 'from-blue-600 via-indigo-500 to-cyan-400',
    step: 2,
  },
  ready: {
    percent: 88,
    label: 'Ready for Pickup',
    dotColor: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-teal-400',
    step: 3,
  },
  completed: {
    percent: 100,
    label: 'Completed',
    dotColor: 'bg-emerald-600',
    gradient: 'from-emerald-600 to-green-500',
    step: 4,
  },
}

export function OrderFulfillmentBar({
  status,
  showLabel = false,
  showSteps = false,
  size = 'md',
  className,
}: {
  status: OrderStatus
  showLabel?: boolean
  showSteps?: boolean
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  const config = fulfillmentConfig[status] ?? fulfillmentConfig.pending
  const heightClass = size === 'xs' ? 'h-1' : size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div className={cn('flex flex-col gap-1 w-full', className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-muted-foreground flex items-center gap-1.5">
            <span
              className={cn(
                'size-1.5 rounded-full',
                config.dotColor,
                status === 'brewing' && 'animate-ping'
              )}
            />
            {config.label}
          </span>
          <span className="font-semibold tabular-nums text-foreground">{config.percent}%</span>
        </div>
      )}
      <div className={cn('relative w-full overflow-hidden rounded-full bg-muted/60 dark:bg-muted/40', heightClass)}>
        <motion.div
          className={cn('h-full rounded-full bg-gradient-to-r', config.gradient)}
          initial={{ width: 0 }}
          animate={{ width: `${config.percent}%` }}
          transition={{
            type: 'spring',
            stiffness: 140,
            damping: 20,
          }}
        />
        {status === 'brewing' && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/25 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: 'linear',
            }}
          />
        )}
      </div>
      {showSteps && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
          <span className={cn(config.step >= 1 ? 'text-foreground font-semibold' : 'opacity-60')}>Queued</span>
          <span className={cn(config.step >= 2 ? 'text-foreground font-semibold' : 'opacity-60')}>Brewing</span>
          <span className={cn(config.step >= 3 ? 'text-foreground font-semibold' : 'opacity-60')}>Ready</span>
          <span className={cn(config.step >= 4 ? 'text-foreground font-semibold' : 'opacity-60')}>Served</span>
        </div>
      )}
    </div>
  )
}

export function MetricProgressBar({
  value,
  label,
  className,
}: {
  value: number
  label?: string
  className?: string
}) {
  return (
    <div className={cn('pt-3 flex flex-col gap-2 w-full', className)}>
      <div className="flex items-center justify-between text-xs md:text-sm">
        <span className="text-muted-foreground font-semibold">{label ?? 'Target: < 5.0 min SLA'}</span>
        <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs md:text-sm">
          {value}% SLA Met
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/80 dark:bg-muted/50 border border-border/40">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-status-available"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
          transition={{
            type: 'spring',
            stiffness: 120,
            damping: 18,
            delay: 0.2,
          }}
        />
      </div>
    </div>
  )
}

