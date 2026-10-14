'use client'

import { useState } from 'react'
import { Activity, BarChart2 } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatCurrency, paymentLabels } from '@/lib/admin/format'

const revenueConfig = {
  revenue: { label: 'Doanh thu', color: 'var(--chart-1)' },
  orders: { label: 'Đơn hàng', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function RevenueChart({ data }: { data: { day: string; revenue: number; orders: number }[] }) {
  const [mode, setMode] = useState<'area' | 'bar'>('area')
  const total = data.reduce((sum, day) => sum + day.revenue, 0)
  return (
    <div className="lg:col-span-2 rounded-xl border border-stone-200/90 bg-white p-6 md:p-8 min-h-[460px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 hover:border-stone-300 hover:shadow-md flex flex-col justify-between gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
            <span>Xu hướng doanh thu theo ngày</span>
            <span className="sr-only">Revenue Daily Revenue Trend</span>
          </h2>
          <p className="text-sm md:text-base text-stone-600 font-medium mt-1">
            Tổng cộng {formatCurrency(total)} doanh thu đã thanh toán tuần này
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-stone-100 p-1.5 border border-stone-200/60">
          <Button
            size="sm"
            variant={mode === 'area' ? 'secondary' : 'ghost'}
            className="h-9 px-3.5 text-sm font-semibold rounded-lg"
            onClick={() => setMode('area')}
          >
            <Activity className="mr-1.5 size-4" /> Dạng vùng
          </Button>
          <Button
            size="sm"
            variant={mode === 'bar' ? 'secondary' : 'ghost'}
            className="h-9 px-3.5 text-sm font-semibold rounded-lg"
            onClick={() => setMode('bar')}
          >
            <BarChart2 className="mr-1.5 size-4" /> Dạng cột
          </Button>
        </div>
      </div>

      <div className="w-full">
        <ChartContainer config={revenueConfig} className="aspect-auto h-72 md:h-[320px] w-full">
          {mode === 'area' ? (
            <AreaChart data={data} margin={{ left: 8, right: 16, top: 12, bottom: 4 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={12} className="text-xs md:text-sm font-semibold" />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(value: number) =>
                  value >= 1000000 ? `${(value / 1000000).toFixed(1)}Tr` : value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}đ`
                }
                className="text-xs md:text-sm font-semibold"
              />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} indicator="line" />}
              />
              <Area
                dataKey="revenue"
                type="monotone"
                stroke="var(--color-revenue)"
                strokeWidth={4}
                fill="url(#revenueFill)"
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ left: 8, right: 16, top: 12, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={12} className="text-xs md:text-sm font-semibold" />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(value: number) =>
                  value >= 1000000 ? `${(value / 1000000).toFixed(1)}Tr` : value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}đ`
                }
                className="text-xs md:text-sm font-semibold"
              />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} indicator="dashed" />}
              />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[8, 8, 0, 0]} />
            </BarChart>
          )}
        </ChartContainer>
      </div>
    </div>
  )
}

const drinkColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export function TopDrinksChart({ data }: { data: { name: string; sold: number }[] }) {
  const total = data.reduce((sum, drink) => sum + drink.sold, 0)
  const config = Object.fromEntries(
    data.map((drink, index) => [drink.name, { label: drink.name, color: drinkColors[index % drinkColors.length] }]),
  ) satisfies ChartConfig

  return (
    <div className="rounded-xl border border-stone-200/90 bg-white p-6 md:p-8 min-h-[460px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 hover:border-stone-300 hover:shadow-md flex flex-col justify-between gap-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
          <span>Top món bán chạy</span>
          <span className="sr-only">Drinks Top-Selling Drinks</span>
        </h2>
        <p className="text-sm md:text-base text-stone-600 font-medium mt-1">
          Phân bổ tỷ trọng các món bán ra trong tuần
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <ChartContainer config={config} className="mx-auto aspect-square h-48 md:h-52">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
            <Pie data={data} dataKey="sold" nameKey="name" innerRadius={54} outerRadius={90} strokeWidth={3} stroke="#ffffff">
              {data.map((drink, index) => (
                <Cell key={drink.name} fill={drinkColors[index % drinkColors.length]} />
              ))}
              <Label
                content={({ viewBox }) =>
                  viewBox && 'cx' in viewBox ? (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-stone-900 text-3xl md:text-4xl font-extrabold tracking-tight tabular-nums">
                        {total}
                      </tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 22} className="fill-stone-500 text-sm font-bold uppercase tracking-wider">
                        ly đã bán
                      </tspan>
                    </text>
                  ) : null
                }
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        <ul className="flex flex-col gap-2.5 pt-4 border-t border-stone-100">
          {data.map((drink, index) => {
            const percent = total > 0 ? Math.round((drink.sold / total) * 100) : 0
            return (
              <li key={drink.name} className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-stone-50 transition-colors">
                <span className="size-3.5 shrink-0 rounded-full shadow-xs" style={{ background: drinkColors[index % drinkColors.length] }} aria-hidden="true" />
                <span className="truncate text-sm md:text-base font-semibold text-stone-900 tracking-tight">{drink.name}</span>
                <span className="ml-auto text-xs md:text-sm font-semibold text-stone-500 tabular-nums">{percent}%</span>
                <span className="text-sm md:text-base font-extrabold tabular-nums text-[#5A3E2B] bg-[#F9F7F4] px-2.5 py-0.5 rounded-md border border-stone-200/90">
                  {drink.sold}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

const paymentConfig = { total: { label: 'Doanh thu', color: 'var(--chart-2)' } } satisfies ChartConfig

export function PaymentMixChart({ data }: { data: { method: 'cash' | 'qr' | 'card'; total: number }[] }) {
  const rows = data.map((row) => ({ ...row, label: paymentLabels[row.method] }))
  return (
    <div className="rounded-xl border border-stone-200/90 bg-white p-6 md:p-8 min-h-[460px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 hover:border-stone-300 hover:shadow-md flex flex-col justify-between gap-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
          <span>Cơ cấu phương thức thanh toán</span>
          <span className="sr-only">Payment Payment Methods Mix</span>
        </h2>
        <p className="text-sm md:text-base text-stone-600 font-medium mt-1">Phân bổ doanh thu theo hình thức thanh toán</p>
      </div>
      <div>
        <ChartContainer config={paymentConfig} className="aspect-auto h-72 md:h-80 w-full">
          <BarChart data={rows} layout="vertical" margin={{ left: 12, right: 24, top: 12, bottom: 12 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.25} />
            <XAxis type="number" hide />
            <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={100} className="text-sm font-semibold" />
            <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} hideLabel />} />
            <Bar dataKey="total" fill="var(--color-total)" radius={8} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  )
}
