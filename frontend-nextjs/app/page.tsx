import { getProducts, type Product } from '@/lib/shopify'
import { getOverview, getTables } from '@/lib/admin/queries'
import { RoleSwitcherView } from '@/components/role-switcher-view'

export const dynamic = 'force-dynamic'

export default async function Page() {
  let products: Product[] = []
  let catalogError: string | undefined

  try {
    products = await getProducts()
  } catch {
    catalogError = 'Our menu is taking a little coffee break. Please refresh to try again.'
  }

  let initialOverview
  let initialTables

  try {
    const [overview, tables] = await Promise.all([getOverview(), getTables()])
    initialOverview = overview
    initialTables = tables
  } catch (err) {
    console.warn('Failed to load initial admin overview:', err)
  }

  return (
    <RoleSwitcherView
      products={products}
      catalogError={catalogError}
      storeDomain={process.env.SHOPIFY_STORE_DOMAIN}
      initialOverview={initialOverview}
      initialTables={initialTables}
    />
  )
}
