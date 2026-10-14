'use client'

import { useState } from 'react'
import { Activity, BarChart2 } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

export interface RevenueDayItem {
  day: string
  revenue: number
  orders: number
}

interface RevenueChartProps {
  data?: RevenueDayItem[]
}

const defaultRevenueData: RevenueDayItem[] = [
  { day: 'Thứ 2', revenue: 8400000, orders: 112 },
  { day: 'Thứ 3', revenue: 9800000, orders: 135 },
  { day: 'Thứ 4', revenue: 11200000, orders: 154 },
  { day: 'Thứ 5', revenue: 10500000, orders: 146 },
  { day: 'Thứ 6', revenue: 14800000, orders: 198 },
  { day: 'Thứ 7', revenue: 18900000, orders: 245 },
  { day: 'Chủ nhật', revenue: 16400000, orders: 218 },
]

const revenueConfig = {
  revenue: { label: 'Doanh thu', color: '#3E2723' },
  orders: { label: 'Số đơn', color: '#C88A58' },
} satisfies ChartConfig

const formatCurrency = (val: number) => {
  const num = val < 500 ? Math.round(val * 10000) : Math.round(val)
  return `${num.toLocaleString('vi-VN')} đ`
}

export function RevenueChart({ data = defaultRevenueData }: RevenueChartProps) {
  const [chartMode, setChartMode] = useState<'area' | 'bar'>('area')
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0)
  const totalOrders = data.reduce((sum, item) => sum + item.orders, 0)

  return (
    <div className="rounded-xl border border-stone-200/80 bg-white p-6 md:p-8 min-h-[420px] md:min-h-[460px] shadow-sm transition-all duration-300 hover:shadow-md hover:border-stone-300 flex flex-col justify-between gap-6">
      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
            <span>Biểu đồ doanh thu tuần này</span>
            <span className="sr-only">Daily Revenue Trend</span>
          </h2>
          <p className="text-sm md:text-base text-stone-600 font-medium mt-1">
            Tổng cộng <span className="font-bold text-stone-900 tabular-nums">{formatCurrency(totalRevenue)}</span> từ{' '}
            <span className="font-bold text-stone-900 tabular-nums">{totalOrders}</span> đơn hàng đã thanh toán trong tuần
          </p>
        </div>

        {/* Toggle Area vs Bar */}
        <div className="flex items-center gap-1.5 rounded-lg bg-stone-100 p-1.5 border border-stone-200 self-start sm:self-auto">
          <Button
            size="sm"
            variant={chartMode === 'area' ? 'default' : 'ghost'}
            className={`h-9 px-4 text-xs md:text-sm font-bold rounded-lg transition-all ${
              chartMode === 'area'
                ? 'bg-[#3E2723] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
            onClick={() => setChartMode('area')}
          >
            <Activity className="mr-1.5 size-4" /> Dạng vùng
          </Button>
          <Button
            size="sm"
            variant={chartMode === 'bar' ? 'default' : 'ghost'}
            className={`h-9 px-4 text-xs md:text-sm font-bold rounded-lg transition-all ${
              chartMode === 'bar'
                ? 'bg-[#3E2723] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
            onClick={() => setChartMode('bar')}
          >
            <BarChart2 className="mr-1.5 size-4" /> Dạng cột
          </Button>
        </div>
      </div>

      {/* Chart Visualization Area */}
      <div className="w-full">
        <ChartContainer config={revenueConfig} className="aspect-auto h-72 md:h-[320px] w-full">
          {chartMode === 'area' ? (
            <AreaChart data={data} margin={{ left: 8, right: 16, top: 12, bottom: 4 }}>
              <defs>
                <linearGradient id="areaRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C88A58" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#C88A58" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} stroke="#e7e5e4" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                className="text-xs md:text-sm font-semibold text-stone-600"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={75}
                tickFormatter={(val: number) => {
                  if (val >= 1000000) return `${(val / 1000000).toFixed(0)}Tr`
                  if (val >= 1000) return `${(val / 1000).toFixed(0)}K`
                  return String(val)
                }}
                className="text-xs md:text-sm font-semibold text-stone-600 tabular-nums"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(val) => `$${Number(val).toLocaleString()}`}
                    indicator="line"
                  />
                }
              />
              <Area
                dataKey="revenue"
                type="monotone"
                stroke="#3E2723"
                strokeWidth={4}
                fill="url(#areaRevenueGradient)"
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ left: 8, right: 16, top: 12, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} stroke="#e7e5e4" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                className="text-xs md:text-sm font-semibold text-stone-600"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={60}
                tickFormatter={(val: number) => `$${val}`}
                className="text-xs md:text-sm font-semibold text-stone-600"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(val) => `$${Number(val).toLocaleString()}`}
                    indicator="dashed"
                  />
                }
              />
              <Bar dataKey="revenue" fill="#3E2723" radius={[8, 8, 0, 0]} />
            </BarChart>
          )}
        </ChartContainer>
      </div>
    </div>
  )
}
export default RevenueChart
