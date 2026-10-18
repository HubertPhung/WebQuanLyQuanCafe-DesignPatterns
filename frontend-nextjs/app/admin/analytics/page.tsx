import { PaymentMixChart, RevenueChart, TopDrinksChart } from '@/components/admin/dashboard-charts'
import { PageHeading } from '@/components/admin/shared'
import { StaggerContainer, StaggerItem } from '@/components/admin/motion-stagger'
import { getOverview } from '@/lib/admin/queries'
import { requirePageRole } from '@/lib/auth/session'

export const metadata = { title: 'Báo cáo phân tích' }

export default async function AnalyticsPage() {
  await requirePageRole('MANAGER', '/admin/analytics')
  const { revenueByDay, topDrinks, paymentMix, source } = await getOverview()
  return (
    <>
      <PageHeading
        title={
          <>
            Báo cáo phân tích <span className="sr-only">Analytics</span>
          </>
        }
        description={`Hiệu suất bán hàng tuần này của chi nhánh 123 Phan Đình Phùng. Nguồn: ${
          source === 'java' ? 'máy chủ Java (GET /api/analytics/overview)' : 'dữ liệu cục bộ (máy chủ Java không phản hồi)'
        }.`}
      />
      <StaggerContainer className="grid gap-6 lg:gap-8 lg:grid-cols-3">
        <StaggerItem className="lg:col-span-2">
          <RevenueChart data={revenueByDay} />
        </StaggerItem>
        <StaggerItem>
          <TopDrinksChart data={topDrinks} />
        </StaggerItem>
        <StaggerItem className="lg:col-span-3">
          <PaymentMixChart data={paymentMix} />
        </StaggerItem>
      </StaggerContainer>
    </>
  )
}
