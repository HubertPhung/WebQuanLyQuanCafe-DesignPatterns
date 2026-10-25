import { CheckoutForm } from '@/components/storefront/checkout-form'
import { requirePageRole } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Thanh toán · Đà Lạt Cafe' }

// Đặt món cần tài khoản, để đơn hiện trong lịch sử và được cộng điểm.
export default async function CheckoutPage() {
  const session = await requirePageRole('CUSTOMER', '/checkout')
  return <CheckoutForm account={{ name: session.name, email: session.email }} />
}
