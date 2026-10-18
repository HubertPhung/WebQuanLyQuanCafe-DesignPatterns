import 'server-only'
import { getMenuProducts } from '@/lib/storefront/menu-catalog'

export type Money = { amount: string; currencyCode: string }
export type Product = {
  id: string
  title: string
  description: string
  productType: string
  tags: string[]
  featuredImage: { url: string; altText: string | null } | null
  variants: {
    nodes: {
      id: string
      title: string
      availableForSale: boolean
      price: Money
    }[]
  }
}
export type Cart = {
  id: string
  checkoutUrl: string
  totalQuantity: number
  note: string
  discountCodes: { code: string; applicable: boolean }[]
  cost: { subtotalAmount: Money; totalAmount: Money }
  lines: {
    nodes: {
      id: string
      quantity: number
      attributes: { key: string; value: string }[]
      merchandise: {
        id: string
        title: string
        price: Money
        product: { title: string; featuredImage: { url: string } | null }
      }
    }[]
  }
}

export async function shopify<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!domain || !process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN) throw new Error('The store connection is not ready. Please try again shortly.')
  const response = await fetch(`https://${domain}/api/2026-04/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  const result = await response.json()
  if (!response.ok || result.errors) throw new Error('The store is temporarily unavailable. Please try again.')
  return result.data
}

// Shopify when a store is connected; otherwise (or when Shopify fails) the café's own menu, so
// every product a guest can order is one the POS, Java and the kitchen know.
export async function getProducts(): Promise<Product[]> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!domain || !process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN) {
    return getMenuProducts()
  }
  try {
    const data = await shopify<{ products: { nodes: Product[] } }>(
      `query { products(first: 40, sortKey: CREATED_AT) { nodes { id title description productType tags featuredImage { url altText } variants(first: 10) { nodes { id title availableForSale price { amount currencyCode } } } } } }`,
    )
    return data.products.nodes.length > 0 ? data.products.nodes : getMenuProducts()
  } catch (error) {
    console.warn('Shopify API connection failed, falling back to the café menu:', error)
    return getMenuProducts()
  }
}

export const cartFields = `id checkoutUrl totalQuantity note discountCodes { code applicable } cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } } lines(first: 100) { nodes { id quantity attributes { key value } merchandise { ... on ProductVariant { id title price { amount currencyCode } product { title featuredImage { url } } } } } }`
export const formatMoney = (money: Money) => new Intl.NumberFormat('en-US', { style: 'currency', currency: money.currencyCode }).format(Number(money.amount))
