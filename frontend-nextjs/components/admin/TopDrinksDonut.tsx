'use client'

import { Cell, Label, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

export interface TopDrinkItem {
  name: string
  sold: number
  price?: number
}

interface TopDrinksDonutProps {
  data?: TopDrinkItem[]
}

const defaultDrinks: TopDrinkItem[] = [
  { name: 'Cà phê Muối Đặc Biệt', sold: 67, price: 45000 },
  { name: 'Cà phê Latte Vani Mịn', sold: 48, price: 55000 },
  { name: 'Cold Brew Cam Vàng', sold: 34, price: 60000 },
  { name: 'Bạc Xỉu Sữa Tươi', sold: 29, price: 40000 },
  { name: 'Trà Đào Cam Sả', sold: 22, price: 50000 },
]

const drinkColors = ['#3E2723', '#C88A58', '#D97706', '#8D6E63', '#BCAAA4']

export function TopDrinksDonut({ data = defaultDrinks }: TopDrinksDonutProps) {
  const totalCups = data.reduce((sum, item) => sum + item.sold, 0)

  const config = Object.fromEntries(
    data.map((drink, index) => [
      drink.name,
      { label: drink.name, color: drinkColors[index % drinkColors.length] },
    ])
  ) satisfies ChartConfig

  return (
    <div className="rounded-xl border border-stone-200/80 bg-white p-6 md:p-8 min-h-[420px] md:min-h-[460px] shadow-sm transition-all duration-300 hover:shadow-md hover:border-stone-300 flex flex-col justify-between gap-6">
      {/* Header */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
          <span>Top món bán chạy</span>
          <span className="sr-only">Top-Selling Drinks</span>
        </h2>
        <p className="text-sm md:text-base text-stone-600 font-medium mt-1">
          Phân bổ tỷ trọng các món thức uống bán ra trong tuần
          <span className="sr-only">Donut breakdown of cups sold this week</span>
        </p>
      </div>

      {/* Chunky Donut Chart */}
      <div className="flex flex-col gap-6">
        <ChartContainer config={config} className="mx-auto aspect-square h-48 md:h-56">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
            <Pie
              data={data}
              dataKey="sold"
              nameKey="name"
              innerRadius={56}
              outerRadius={92}
              strokeWidth={4}
              stroke="#ffffff"
            >
              {data.map((drink, index) => (
                <Cell key={drink.name} fill={drinkColors[index % drinkColors.length]} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !('cx' in viewBox)) return null
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-stone-900 text-3xl md:text-4xl font-extrabold tracking-tight tabular-nums"
                      >
                        {totalCups}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 22}
                        className="fill-stone-500 text-xs md:text-sm font-bold uppercase tracking-wider"
                      >
                        ly đã bán
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        {/* Comfortable Items List */}
        <ul className="flex flex-col gap-3 pt-4 border-t border-stone-100">
          {data.map((drink, index) => {
            const percent = totalCups > 0 ? Math.round((drink.sold / totalCups) * 100) : 0
            return (
              <li
                key={drink.name}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-stone-50 transition-colors"
              >
                <span
                  className="size-3.5 shrink-0 rounded-full shadow-2xs"
                  style={{ background: drinkColors[index % drinkColors.length] }}
                  aria-hidden="true"
                />
                <span className="truncate text-sm md:text-base font-semibold text-stone-900 tracking-tight">
                  {drink.name}
                </span>
                <span className="ml-auto text-xs md:text-sm font-semibold text-stone-500 tabular-nums">
                  {percent}%
                </span>
                <span className="text-sm md:text-base font-bold tabular-nums bg-[#f5efe6] text-[#3E2723] px-3 py-1 rounded-lg border border-[#e7ddd0]">
                  {drink.sold} ly
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
export default TopDrinksDonut
