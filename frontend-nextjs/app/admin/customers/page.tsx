import { PageHeading } from '@/components/admin/shared'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/admin/format'
import { getCustomers } from '@/lib/admin/queries'

export const metadata = { title: 'Khách hàng' }

const rankLabels: Record<string, string> = { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', vip: 'VIP' }

export default async function CustomersPage() {
  const { customers, source } = await getCustomers()
  const showPoints = source === 'java'
  return (
    <>
      <PageHeading
        title={
          <>
            Khách hàng thân thiết <span className="sr-only">Customers</span>
          </>
        }
        description={
          showPoints
            ? 'Thành viên tích điểm từ máy chủ Java, xếp theo tổng chi tiêu tích lũy.'
            : 'Danh sách khách hàng trong 90 ngày gần nhất (dữ liệu cục bộ), xếp theo tổng chi tiêu tích lũy.'
        }
      />
      <Card className="rounded-xl border border-stone-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <CardContent className="pt-6">
          <div className="rounded-lg border border-stone-200/90 overflow-hidden">
            <Table>
              <TableHeader className="bg-stone-50/60">
                <TableRow className="border-b border-stone-200/90 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-stone-500 uppercase tracking-wider py-3 px-3">
                    Khách hàng <span className="sr-only">Customer</span>
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider py-3 px-3">
                    Số đơn <span className="sr-only">Orders</span>
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider py-3 px-3">
                    Tổng chi tiêu <span className="sr-only">Total spent</span>
                  </TableHead>
                  {showPoints && (
                    <TableHead className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider py-3 px-3">
                      Điểm · Hạng <span className="sr-only">Points and rank</span>
                    </TableHead>
                  )}
                  <TableHead className="hidden text-right sm:table-cell text-xs font-semibold text-stone-500 uppercase tracking-wider py-3 px-3">
                    Lần ghé gần nhất <span className="sr-only">Last visit</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.name} className="hover:bg-stone-50/60 transition-colors border-b border-stone-200/60">
                    <TableCell className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8 text-xs font-bold bg-[#5A3E2B] text-amber-300 border border-stone-200">
                          <AvatarFallback>
                            {customer.name
                              .split(' ')
                              .map((part) => part[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-stone-900 text-sm">{customer.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-semibold text-stone-700 py-3 px-3">{customer.orders} đơn</TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-bold text-[#5A3E2B] py-3 px-3">{formatCurrency(customer.spent)}</TableCell>
                    {showPoints && (
                      <TableCell className="text-right tabular-nums text-sm text-stone-700 py-3 px-3">
                        {(customer.points ?? 0).toLocaleString('vi-VN')} · {rankLabels[customer.rank ?? ''] ?? customer.rank}
                      </TableCell>
                    )}
                    <TableCell className="hidden text-right text-xs text-stone-500 sm:table-cell font-medium py-3 px-3">
                      {customer.lastVisit.getTime() > 0
                        ? customer.lastVisit.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
