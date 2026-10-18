import { PaymentMixChart, RevenueChart, TopDrinksChart } from '@/components/admin/dashboard-charts'
import { PageHeading } from '@/components/admin/shared'
import { StaggerContainer, StaggerItem } from '@/components/admin/motion-stagger'
import { getAdminBranch } from '@/lib/admin/branch'
import { branchById } from '@/lib/branches'
import { getOverview } from '@/lib/admin/queries'
import { requirePageRole } from '@/lib/auth/session'

export const metadata = { title: 'Báo cáo phân tích' }

export default async function AnalyticsPage() {
  await requirePageRole('MANAGER', '/admin/analytics')
  const [branchId, { revenueByDay, topDrinks, paymentMix }] = await Promise.all([
    getAdminBranch(),
    getOverview(),
  ])
  const branch = branchById(branchId)
  return (
    <>
      <PageHeading
        title={
          <>
            Báo cáo phân tích <span className="sr-only">Analytics</span>
          </>
        }
        description={`Hiệu suất bán hàng tuần này của chi nhánh ${branch.street}.`}
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
