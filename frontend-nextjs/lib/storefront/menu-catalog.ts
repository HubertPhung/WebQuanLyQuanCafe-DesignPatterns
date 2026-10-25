import 'server-only'
import { asc, eq } from 'drizzle-orm'
import { db, isDbConfigured } from '@/lib/db'
import { adminMenuItems, type MenuItem } from '@/lib/db/schema'
import { getMockMenuItems } from '@/lib/db/mock-store'
import { posCustomizations } from '@/lib/admin/customizations'
import type { Product } from '@/lib/shopify'
import { DRINK_TAG } from './product-tags'

// Storefront bán chính thực đơn của quán (các admin_menu_items mà POS bán), nên đơn online được
// tính giá, kiểm tra còn bán và pha chế y như đơn tại quầy. Đồ uống có size M hoặc L; L là
// customization "SIZE_L" của POS, được LargeSizeDecorator bên Java tính giá.

const VARIANT_ID = /^gid:\/\/dalatcafe\/ProductVariant\/(\d+)(-L)?$/
const SIZE_L = posCustomizations.find((option) => option.id === 'SIZE_L')!.price

export type MenuVariant = { menuItemId: number; large: boolean }

export function menuVariantId(menuItemId: number, large = false) {
  return `gid://dalatcafe/ProductVariant/${menuItemId}${large ? '-L' : ''}`
}

export function parseMenuVariant(id: string): MenuVariant | null {
  const match = VARIANT_ID.exec(id)
  return match ? { menuItemId: Number(match[1]), large: Boolean(match[2]) } : null
}

// Bánh ngọt, đồ ăn vặt, kem và cà phê hạt bán lẻ không có lựa chọn size, đường hay đá.
function isDrink(item: MenuItem) {
  return !/^bánh\b/i.test(item.name.trim()) && !/^(bánh|món ăn|kem|hạt)/i.test(item.category.trim())
}

function fallbackImage(item: MenuItem) {
  const text = `${item.name} ${item.category}`.toLowerCase()
  if (!isDrink(item)) return '/images/croissant.png'
  if (text.includes('ủ lạnh') || text.includes('cold brew')) return '/images/cold-brew.png'
  if (text.includes('hạt')) return '/images/beans.png'
  return '/images/latte.png'
}

function toProduct(item: MenuItem): Product {
  const available = item.inStock
  const price = (amount: number) => ({ amount: String(amount), currencyCode: 'VND' })
  const drink = isDrink(item)
  return {
    id: `gid://dalatcafe/Product/${item.id}`,
    title: item.name,
    description: item.recipe || `${item.name} pha theo công thức của Đà Lạt Cafe.`,
    productType: item.category,
    tags: drink ? [item.category, DRINK_TAG] : [item.category],
    featuredImage: { url: item.imageUrl || fallbackImage(item), altText: item.name },
    variants: {
      nodes: drink
        ? [
            { id: menuVariantId(item.id), title: 'Size M', availableForSale: available, price: price(item.sellPrice) },
            {
              id: menuVariantId(item.id, true),
              title: `Size L (+${SIZE_L.toLocaleString('vi-VN')} đ)`,
              availableForSale: available,
              price: price(item.sellPrice + SIZE_L),
            },
          ]
        : [{ id: menuVariantId(item.id), title: `1 ${item.unit || 'phần'}`, availableForSale: available, price: price(item.sellPrice) }],
    },
  }
}

// Đọc không cần phiên đăng nhập: storefront là công khai. Cùng kho và cách dự phòng với POS.
async function sellableItems(): Promise<MenuItem[]> {
  if (isDbConfigured && db) {
    try {
      return await db.select().from(adminMenuItems).where(eq(adminMenuItems.kind, 'menu')).orderBy(asc(adminMenuItems.category), asc(adminMenuItems.name))
    } catch (error) {
      console.warn('Menu query failed, using the mock store:', error)
    }
  }
  return getMockMenuItems().filter((item) => item.kind === 'menu')
}

export async function getMenuProducts(): Promise<Product[]> {
  return (await sellableItems()).map(toProduct)
}

export async function findMenuVariant(variantId: string) {
  const parsed = parseMenuVariant(variantId)
  if (!parsed) return null
  const item = (await sellableItems()).find((candidate) => candidate.id === parsed.menuItemId)
  if (!item) return null
  const product = toProduct(item)
  const variant = product.variants.nodes.find((node) => node.id === variantId)
  return variant ? { product, variant, item, large: parsed.large } : null
}
