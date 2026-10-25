import { getProducts, type Product } from '@/lib/shopify'
import { getOverview, getTables } from '@/lib/admin/queries'
import { RoleSwitcherView } from '@/components/role-switcher-view'
import { getSession } from '@/lib/auth/session'
import { atLeast } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export default async function Page() {
  let products: Product[] = []
  let catalogError: string | undefined

  try {
    products = await getProducts()
  } catch {
    catalogError = 'Our menu is taking a little coffee break. Please refresh to try again.'
  }

  const session = await getSession()
  let initialOverview
  let initialTables

  // The staff dashboard needs floor and sales data; guests and customers never see it, so
  // they must not trigger the admin queries (which refuse them) on every visit.
  if (session && atLeast(session.role, 'STAFF')) {
    try {
      const [overview, tables] = await Promise.all([getOverview(), getTables()])
      initialOverview = overview
      initialTables = tables
    } catch (err) {
      console.warn('Failed to load initial admin overview:', err)
    }
  }

  return (
    <RoleSwitcherView
      account={session ? { name: session.name, email: session.email, role: session.role } : null}
      products={products}
      catalogError={catalogError}
      storeDomain={process.env.SHOPIFY_STORE_DOMAIN}
      initialOverview={initialOverview}
      initialTables={initialTables}
    />
  )
}
