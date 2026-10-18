import { CheckoutForm } from '@/components/storefront/checkout-form'
import { requirePageRole } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Thanh toán · Đà Lạt Cafe' }

// Ordering needs an account, so the order shows up in its history and earns its points.
export default async function CheckoutPage() {
  const session = await requirePageRole('CUSTOMER', '/checkout')
  return <CheckoutForm account={{ name: session.name, email: session.email }} />
}
