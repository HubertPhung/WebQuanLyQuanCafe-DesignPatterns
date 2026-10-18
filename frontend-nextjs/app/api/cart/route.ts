import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Cart, cartFields, shopify } from '@/lib/shopify'
import { validateVoucher } from '@/lib/api-client'
import { findMenuVariant } from '@/lib/storefront/menu-catalog'
import { findVoucher, voucherDiscount } from '@/lib/storefront/vouchers'
import { getSession } from '@/lib/auth/session'
import { isFirstOnlineOrderAvailable } from '@/lib/orders/first-online-order'

const isShopifyConfigured = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN)

const OPTION_KEYS = ['Milk', 'Sugar', 'Sweetness', 'Ice']

// Java's VoucherCatalog decides whether a code exists (POST /api/vouchers/validate, the same
// Strategy checkout applies); without Java, the copy of that catalog in lib/storefront/vouchers.
async function isVoucherApplicable(code: string, subtotal: number): Promise<boolean> {
  if (code.trim().toUpperCase() === 'WELCOME10') {
    const session = await getSession()
    if (!session || !(await isFirstOnlineOrderAvailable(session.userId))) return false
  }
  const verdict = await validateVoucher(code, subtotal)
  if (verdict.ok) return verdict.data.valid
  return Boolean(findVoucher(code))
}

async function getLocalCart(): Promise<Cart | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('dalatcafe-local-cart')?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as Cart
  } catch {
    return null
  }
}

async function setLocalCart(cart: Cart | null) {
  const cookieStore = await cookies()
  if (!cart) {
    cookieStore.delete('dalatcafe-local-cart')
    return
  }
  cookieStore.set('dalatcafe-local-cart', JSON.stringify(cart), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  })
}

async function refreshWelcomeEligibility(cart: Cart | null): Promise<Cart | null> {
  if (!cart || isShopifyConfigured) return cart
  for (const code of cart.discountCodes) {
    if (code.code.trim().toUpperCase() === 'WELCOME10') {
      const subtotal = cart.lines.nodes.reduce((sum, line) => sum + Number(line.merchandise.price.amount) * line.quantity, 0)
      code.applicable = await isVoucherApplicable(code.code, subtotal)
    }
  }
  cart.cost = calculateCost(cart.lines.nodes, cart.discountCodes)
  return cart
}

function calculateCost(lines: Cart['lines']['nodes'], discountCodes: { code: string; applicable: boolean }[]) {
  const subtotal = lines.reduce((sum, line) => sum + Number(line.merchandise.price.amount) * line.quantity, 0)
  const discount = voucherDiscount(subtotal, discountCodes.find((d) => d.applicable)?.code)
  const total = subtotal - discount
  const currencyCode = lines[0]?.merchandise.price.currencyCode ?? 'VND'
  return {
    subtotalAmount: { amount: subtotal.toFixed(2), currencyCode },
    totalAmount: { amount: total.toFixed(2), currencyCode },
  }
}

async function currentCart(): Promise<Cart | null> {
  if (!isShopifyConfigured) {
    return getLocalCart()
  }
  try {
    const id = (await cookies()).get('dalatcafe-cart')?.value
    if (!id) return null
    return (await shopify<{ cart: Cart | null }>(`query($id: ID!) { cart(id: $id) { ${cartFields} } }`, { id })).cart
  } catch {
    return getLocalCart()
  }
}

export async function GET() {
  try {
    return NextResponse.json(await refreshWelcomeEligibility(await currentCart()))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  if (request.headers.get('sec-fetch-site') !== 'same-origin' && request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  }
  // Ordering is for signed-in customers: the order, its points and its history belong to an account.
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập để đặt món.', loginRequired: true }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Demo Mode handling when Shopify is not configured
    if (!isShopifyConfigured) {
      let cart = (await getLocalCart()) ?? {
        id: 'cart-demo-local',
        checkoutUrl: '#',
        totalQuantity: 0,
        note: '',
        discountCodes: [],
        cost: { subtotalAmount: { amount: '0.00', currencyCode: 'VND' }, totalAmount: { amount: '0.00', currencyCode: 'VND' } },
        lines: { nodes: [] },
      }

      if (body.action === 'add') {
        // Price and availability come from the menu, never from the request.
        const match = await findMenuVariant(String(body.variantId ?? ''))
        if (!match) throw new Error('Choose a valid product.')
        if (!match.variant.availableForSale) throw new Error(`${match.product.title} is sold out right now.`)
        const matchedProduct = match.product
        const matchedVariant = match.variant

        const attributes = Object.entries(body.options ?? {})
          .filter(([k, v]) => OPTION_KEYS.includes(k) && typeof v === 'string' && v.length <= 40)
          .map(([key, value]) => ({ key, value: String(value) }))
        // Same drink with other options (milk, sugar, ice) is a separate line, so no choice is lost.
        const sameOptions = (line: Cart['lines']['nodes'][number]) =>
          JSON.stringify(line.attributes) === JSON.stringify(attributes)
        const existingLine = cart.lines.nodes.find((l) => l.merchandise.id === matchedVariant.id && sameOptions(l))

        if (existingLine) {
          existingLine.quantity = Math.min(existingLine.quantity + 1, 20)
        } else {
          cart.lines.nodes.push({
            id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            quantity: 1,
            attributes,
            merchandise: {
              id: matchedVariant.id,
              title: matchedVariant.title,
              price: matchedVariant.price,
              product: {
                title: matchedProduct.title,
                featuredImage: matchedProduct.featuredImage ? { url: matchedProduct.featuredImage.url } : null,
              },
            },
          })
        }
      } else if (body.action === 'quantity') {
        const line = cart.lines.nodes.find((l) => l.id === body.lineId)
        if (!line || !Number.isInteger(body.quantity) || body.quantity < 0 || body.quantity > 20) {
          throw new Error('Invalid quantity.')
        }
        if (body.quantity === 0) {
          cart.lines.nodes = cart.lines.nodes.filter((l) => l.id !== body.lineId)
        } else {
          line.quantity = body.quantity
        }
      } else if (body.action === 'discount') {
        const code = String(body.code ?? '').trim().toUpperCase()
        const subtotal = cart.lines.nodes.reduce((sum, l) => sum + Number(l.merchandise.price.amount) * l.quantity, 0)
        const applicable = code ? await isVoucherApplicable(code, subtotal) : false
        cart.discountCodes = code ? [{ code, applicable }] : []
      } else if (body.action === 'note') {
        cart.note = String(body.note ?? '').slice(0, 500)
      } else {
        throw new Error('Unknown cart action.')
      }

      cart.totalQuantity = cart.lines.nodes.reduce((sum, l) => sum + l.quantity, 0)
      await refreshWelcomeEligibility(cart)
      cart.cost = calculateCost(cart.lines.nodes, cart.discountCodes)

      await setLocalCart(cart)
      return NextResponse.json(cart)
    }

    // Shopify production flow
    let cart = await currentCart()
    let operation: string, args: string, definitions: string, variables: Record<string, unknown>
    if (body.action === 'add') {
      if (typeof body.variantId !== 'string' || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(body.variantId)) {
        throw new Error('Choose a valid product.')
      }
      const existing = cart?.lines.nodes.filter((l) => l.merchandise.id === body.variantId).reduce((sum, l) => sum + l.quantity, 0) ?? 0
      if (existing >= 20) throw new Error('Limit of 20 per product.')
      const attributes = Object.entries(body.options ?? {})
        .filter(([k, v]) => OPTION_KEYS.includes(k) && typeof v === 'string' && v.length <= 40)
        .map(([key, value]) => ({ key, value }))
      const lines = [{ merchandiseId: body.variantId, quantity: 1, attributes }]
      if (!cart) {
        operation = 'cartCreate'
        definitions = '$input: CartInput!'
        args = 'input: $input'
        variables = { input: { lines } }
      } else {
        operation = 'cartLinesAdd'
        definitions = '$id: ID!, $lines: [CartLineInput!]!'
        args = 'cartId: $id, lines: $lines'
        variables = { id: cart.id, lines }
      }
    } else {
      if (!cart) throw new Error('Your bag is empty.')
      if (body.action === 'quantity') {
        const line = cart.lines.nodes.find((l) => l.id === body.lineId)
        if (!line || !Number.isInteger(body.quantity) || body.quantity < 0 || body.quantity > 20) throw new Error('Invalid quantity.')
        const others = cart.lines.nodes.filter((l) => l.id !== line.id && l.merchandise.id === line.merchandise.id).reduce((n, l) => n + l.quantity, 0)
        if (others + body.quantity > 20) throw new Error('Limit of 20 per product.')
        if (body.quantity === 0) {
          operation = 'cartLinesRemove'
          definitions = '$id: ID!, $ids: [ID!]!'
          args = 'cartId: $id, lineIds: $ids'
          variables = { id: cart.id, ids: [line.id] }
        } else {
          operation = 'cartLinesUpdate'
          definitions = '$id: ID!, $lines: [CartLineUpdateInput!]!'
          args = 'cartId: $id, lines: $lines'
          variables = { id: cart.id, lines: [{ id: line.id, quantity: body.quantity }] }
        }
      } else if (body.action === 'discount') {
        if (String(body.code ?? '').trim().toUpperCase() === 'WELCOME10' && !(await isVoucherApplicable('WELCOME10', Number(cart.cost.subtotalAmount.amount)))) {
          throw new Error('WELCOME10 chỉ áp dụng cho đơn online đầu tiên của tài khoản mới.')
        }
        operation = 'cartDiscountCodesUpdate'
        definitions = '$id: ID!, $codes: [String!]!'
        args = 'cartId: $id, discountCodes: $codes'
        variables = { id: cart.id, codes: [String(body.code ?? '').slice(0, 80)] }
      } else if (body.action === 'note') {
        operation = 'cartNoteUpdate'
        definitions = '$id: ID!, $note: String!'
        args = 'cartId: $id, note: $note'
        variables = { id: cart.id, note: String(body.note ?? '').slice(0, 500) }
      } else {
        throw new Error('Unknown cart action.')
      }
    }

    const data = await shopify<Record<string, { cart: Cart; userErrors: { message: string }[] }>>(
      `mutation(${definitions}) { ${operation}(${args}) { cart { ${cartFields} } userErrors { message } } }`,
      variables,
    )
    const result = data[operation]
    if (result.userErrors.length) throw new Error(result.userErrors[0].message)
    cart = result.cart
    ;(await cookies()).set('dalatcafe-cart', cart.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
    })
    return NextResponse.json(cart)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
