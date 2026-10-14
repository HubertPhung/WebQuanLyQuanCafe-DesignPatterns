import 'server-only'

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

export const demoProducts: Product[] = [
  {
    id: 'gid://shopify/Product/1',
    title: 'Cà phê Latte Vani Mịn (Vanilla Velvet Latte)',
    description: 'Double shot espresso thủ công hòa quyện cùng vani bourbon ngọt dịu và sữa tươi thanh trùng đánh bọt mịn màng.',
    productType: 'Espresso',
    tags: ['Món đặc trưng', 'Vừa', 'Vietnam'],
    featuredImage: { url: '/images/latte.png', altText: 'Vanilla Velvet Latte' },
    variants: {
      nodes: [
        { id: 'gid://shopify/ProductVariant/101', title: 'Ly Tiêu Chuẩn (350ml)', availableForSale: true, price: { amount: '55000', currencyCode: 'VND' } },
        { id: 'gid://shopify/ProductVariant/102', title: 'Ly Lớn (480ml)', availableForSale: true, price: { amount: '65000', currencyCode: 'VND' } },
      ],
    },
  },
  {
    id: 'gid://shopify/Product/2',
    title: 'Cà phê Ủ Lạnh Nitro (Nitro Cold Brew)',
    description: 'Ủ lạnh chậm suốt 20 tiếng và rót sục khí Nitơ tạo lớp bọt kem béo ngậy mềm mượt lan tỏa vị socola đen.',
    productType: 'Cold Brew',
    tags: ['Cà phê ủ lạnh', 'Đậm', 'Rót tươi'],
    featuredImage: { url: '/images/cold-brew.png', altText: 'Nitro Cold Brew' },
    variants: {
      nodes: [
        { id: 'gid://shopify/ProductVariant/201', title: 'Ly Thủy Tinh (350ml)', availableForSale: true, price: { amount: '58000', currencyCode: 'VND' } },
        { id: 'gid://shopify/ProductVariant/202', title: 'Bình Rót (1000ml)', availableForSale: true, price: { amount: '140000', currencyCode: 'VND' } },
      ],
    },
  },
  {
    id: 'gid://shopify/Product/3',
    title: 'Cà phê Pour Over Guji Ethiopia',
    description: 'Pha thủ công V60 từ hạt cà phê đặc sản vùng Guji, Ethiopia. Nốt hương hoa nhài hoang dã, đào chín và cam bergamot.',
    productType: 'Pour Over',
    tags: ['Đặc sản đơn vùng', 'Sáng'],
    featuredImage: { url: '/images/hero.png', altText: 'Ethiopian Guji Pour Over' },
    variants: {
      nodes: [
        { id: 'gid://shopify/ProductVariant/301', title: 'Phần Tiêu Chuẩn', availableForSale: true, price: { amount: '65000', currencyCode: 'VND' } },
      ],
    },
  },
  {
    id: 'gid://shopify/Product/4',
    title: 'Bánh Croissant Bơ Hạnh Nhân (Bánh Croissant Bơ Pháp)',
    description: 'Bánh sừng bò bơ Pháp ngàn lớp nướng hai lần với kem frangipane hạnh nhân và hạnh nhân lát rang giòn thơm lừng.',
    productType: 'Pastries',
    tags: ['Bánh mới mỗi ngày', 'Đặc sản quán'],
    featuredImage: { url: '/images/croissant.png', altText: 'Butter Almond Croissant' },
    variants: {
      nodes: [
        { id: 'gid://shopify/ProductVariant/401', title: '1 Chiếc', availableForSale: true, price: { amount: '45000', currencyCode: 'VND' } },
      ],
    },
  },
  {
    id: 'gid://shopify/Product/5',
    title: 'Hạt Cà Phê Đà Lạt House Blend (250g)',
    description: 'Dòng hạt cà phê đặc trưng phối trộn tinh tế giữa Colombia Supremo sơ chế ướt và Ethiopia Sidamo tự nhiên.',
    productType: 'Whole Bean',
    tags: ['Rang vừa', 'Hạt nguyên bản', 'Vietnam'],
    featuredImage: { url: '/images/beans.png', altText: 'Đà Lạt House Blend' },
    variants: {
      nodes: [
        { id: 'gid://shopify/ProductVariant/501', title: 'Nguyên Hạt (250g)', availableForSale: true, price: { amount: '180000', currencyCode: 'VND' } },
        { id: 'gid://shopify/ProductVariant/502', title: 'Xay Cho Pour Over (250g)', availableForSale: true, price: { amount: '180000', currencyCode: 'VND' } },
      ],
    },
  },
  {
    id: 'gid://shopify/Product/6',
    title: 'Cà phê Caramel Macchiato',
    description: 'Sữa tươi đánh nóng đượm hương vani rót cùng lớp espresso kép đậm đà và sốt caramel bơ béo ngậy.',
    productType: 'Espresso',
    tags: ['Rang vừa'],
    featuredImage: { url: '/images/latte.png', altText: 'Caramel Macchiato' },
    variants: {
      nodes: [
        { id: 'gid://shopify/ProductVariant/601', title: 'Ly Tiêu Chuẩn (350ml)', availableForSale: true, price: { amount: '58000', currencyCode: 'VND' } },
      ],
    },
  },
  {
    id: 'gid://shopify/Product/7',
    title: 'Bánh Pain au Chocolat Socola',
    description: 'Bánh pastry ngàn lớp bơ vàng giòn rụm cuộn hai thanh socola đen Valrhona hảo hạng.',
    productType: 'Pastries',
    tags: ['Bánh mới mỗi ngày'],
    featuredImage: { url: '/images/croissant.png', altText: 'Pain au Chocolat' },
    variants: {
      nodes: [
        { id: 'gid://shopify/ProductVariant/701', title: '1 Chiếc', availableForSale: true, price: { amount: '42000', currencyCode: 'VND' } },
      ],
    },
  },
  {
    id: 'gid://shopify/Product/8',
    title: 'Hạt Cà Phê Decaf Colombia Huila (250g)',
    description: 'Hạt cà phê đơn vùng khử caffeine tự nhiên bằng mía đường. Nốt ngọt ngào mật mía, hạt dẻ nướng và hạt cacao.',
    productType: 'Whole Bean',
    tags: ['Rang vừa', 'Khử caffein', 'Hạt nguyên bản'],
    featuredImage: { url: '/images/beans.png', altText: 'Decaf Colombia' },
    variants: {
      nodes: [
        { id: 'gid://shopify/ProductVariant/801', title: 'Nguyên Hạt (250g)', availableForSale: true, price: { amount: '190000', currencyCode: 'VND' } },
      ],
    },
  },
]

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

export async function getProducts(): Promise<Product[]> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!domain || !process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN) {
    return demoProducts
  }
  try {
    const data = await shopify<{ products: { nodes: Product[] } }>(
      `query { products(first: 40, sortKey: CREATED_AT) { nodes { id title description productType tags featuredImage { url altText } variants(first: 10) { nodes { id title availableForSale price { amount currencyCode } } } } } }`,
    )
    return data.products.nodes.length > 0 ? data.products.nodes : demoProducts
  } catch (error) {
    console.warn('Shopify API connection failed, falling back to demo catalog:', error)
    return demoProducts
  }
}

export const cartFields = `id checkoutUrl totalQuantity note discountCodes { code applicable } cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } } lines(first: 100) { nodes { id quantity attributes { key value } merchandise { ... on ProductVariant { id title price { amount currencyCode } product { title featuredImage { url } } } } } }`
export const formatMoney = (money: Money) => new Intl.NumberFormat('en-US', { style: 'currency', currency: money.currencyCode }).format(Number(money.amount))
