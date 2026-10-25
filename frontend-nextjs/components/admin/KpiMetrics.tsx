'use client'

import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Clock, DollarSign, LayoutGrid, Receipt } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface KpiData {
  revenueToday: number
  revenueYesterday: number
  ordersToday: number
  ordersYesterday: number
  activeTables: number
  totalTables: number
  fulfillmentToday: number
  fulfillmentYesterday: number
}

interface KpiMetricsProps {
  data?: Partial<KpiData>
}

const formatCurrency = (amount: number) => {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0
  const vndValue = num < 500 ? Math.round(num * 10000) : Math.round(num)
  return `${vndValue.toLocaleString('vi-VN')} đ`
}

export function KpiMetrics({ data = {} }: KpiMetricsProps) {
  const {
    revenueToday = 14285000,
    revenueYesterday = 12900000,
    ordersToday = 184,
    ordersYesterday = 168,
    activeTables = 11,
    totalTables = 15,
    fulfillmentToday = 4.2,
    fulfillmentYesterday = 4.8,
  } = data

  const revDiff = revenueToday - revenueYesterday
  const revPercent = revenueYesterday > 0 ? ((revDiff / revenueYesterday) * 100).toFixed(1) : '0.0'
  const isRevUp = revDiff >= 0

  const orderDiff = ordersToday - ordersYesterday
  const orderPercent = ordersYesterday > 0 ? ((orderDiff / ordersYesterday) * 100).toFixed(1) : '0.0'
  const isOrderUp = orderDiff >= 0

  const tableOccupancy = totalTables > 0 ? Math.round((activeTables / totalTables) * 100) : 0

  const fulDiff = fulfillmentYesterday - fulfillmentToday
  const fulPercent = fulfillmentYesterday > 0 ? ((Math.abs(fulDiff) / fulfillmentYesterday) * 100).toFixed(1) : '0.0'
  const isFulFaster = fulDiff >= 0

  const cards = [
    {
      labelVi: 'Doanh thu hôm nay',
      labelEn: 'Total revenue today',
      value: formatCurrency(revenueToday),
      icon: DollarSign,
      trendText: `${isRevUp ? '+' : ''}${revPercent}%`,
      trendPositive: isRevUp,
      footnote: `so với hôm qua (${formatCurrency(revenueYesterday)})`,
      badgeTone: isRevUp
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-rose-50 text-rose-700 border-rose-200',
    },
    {
      labelVi: 'Tổng số đơn',
      labelEn: 'Total orders',
      value: String(ordersToday),
      icon: Receipt,
      trendText: `${isOrderUp ? '+' : ''}${orderPercent}%`,
      trendPositive: isOrderUp,
      footnote: `so với hôm qua (${ordersYesterday} đơn)`,
      badgeTone: isOrderUp
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      labelVi: 'Bàn có khách',
      labelEn: 'Active tables',
      value: `${activeTables} / ${totalTables}`,
      icon: LayoutGrid,
      trendText: `${tableOccupancy}% công suất`,
      trendPositive: true,
      footnote: `${totalTables - activeTables} bàn còn trống đón khách`,
      badgeTone: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      labelVi: 'Thời gian ra món TB',
      labelEn: 'Avg. fulfillment time',
      value: `${fulfillmentToday} phút`,
      icon: Clock,
      trendText: isFulFaster ? `Nhanh hơn ${fulPercent}%` : `Chậm hơn ${fulPercent}%`,
      trendPositive: isFulFaster,
      footnote: 'Mục tiêu: < 5 phút',
      badgeTone: isFulFaster
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-amber-50 text-amber-700 border-amber-200',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 md:gap-8">
      {cards.map((card, idx) => (
        <motion.div
          key={card.labelVi}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: idx * 0.07 }}
        >
          <Card className="rounded-xl border border-stone-200/80 bg-white p-6 md:p-8 shadow-sm transition-all duration-300 hover:shadow-md hover:border-stone-300 flex flex-col justify-between gap-6 min-h-[200px]">
            {/* Hàng đầu: nhãn và biểu tượng */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-stone-800 leading-snug">
                  {card.labelVi}
                </p>
              </div>

              <div className="flex size-12 items-center justify-center rounded-lg bg-[#f5efe6] text-[#3E2723] border border-[#e7ddd0] shrink-0 shadow-2xs">
                <card.icon className="size-6" />
              </div>
            </div>

            {/* Giá trị chỉ số */}
            <div>
              <div className="text-3xl md:text-5xl font-bold tracking-tight text-stone-900 tabular-nums leading-none">
                {card.value}
              </div>
            </div>

            {/* Hàng cuối: nhãn màu pastel và chú thích */}
            <div className="flex items-center justify-between gap-2 border-t border-stone-100 pt-4">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border shadow-2xs',
                  card.badgeTone
                )}
              >
                {card.trendPositive ? (
                  <ArrowUpRight className="size-3.5 stroke-[2.5]" />
                ) : (
                  <ArrowDownRight className="size-3.5 stroke-[2.5]" />
                )}
                {card.trendText}
              </span>

              <span className="text-xs text-stone-500 truncate font-medium text-right">
                {card.footnote}
              </span>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
export default KpiMetrics
