import { AccountDashboard } from '@/components/account/account-dashboard'
import { requirePageRole } from '@/lib/auth/session'

export const metadata = { title: 'Tài khoản · Đà Lạt Cafe' }

export default async function AccountPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params
  const tab = slug?.[0] ?? 'orders'
  const session = await requirePageRole('CUSTOMER', `/account/${tab}`)
  return <AccountDashboard user={{ name: session.name, email: session.email }} currentTab={tab} />
}
