import { AccountDashboard } from '@/components/account/account-dashboard'
import { getAccountOverview } from '@/lib/account/queries'
import { requirePageRole } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tài khoản · Đà Lạt Cafe' }

export default async function AccountPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params
  const tab = slug?.[0] ?? 'orders'
  const session = await requirePageRole('CUSTOMER', `/account/${tab}`)
  const overview = await getAccountOverview(session)
  return <AccountDashboard user={{ name: session.name, email: session.email }} currentTab={tab} overview={overview} />
}
