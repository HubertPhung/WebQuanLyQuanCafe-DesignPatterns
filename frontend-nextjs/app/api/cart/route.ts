import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Cart, cartFields, shopify } from '@/lib/shopify'
import { validateVoucher } from '@/lib/api-client'
import { findMenuVariant } from '@/lib/storefront/menu-catalog'
import { normalizeVoucherCode } from '@/lib/storefront/vouchers'
import { getSession } from '@/lib/auth/session'
import { isFirstOnlineOrderAvailable } from '@/lib/orders/first-online-order'

const isShopifyConfigured = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN)

const OPTION_KEYS = ['Milk', 'Sugar', 'Sweetness', 'Ice']

type VoucherCheck = { applicable: boolean; discount: number; message: string }

// VoucherService bên Java quyết định một mã có dùng được không và giảm bao nhiêu (POST
// /api/vouchers/validate, đúng Strategy mà checkout áp dụng). Không có Java thì không mã nào áp
// dụng: storefront không kiểm tra được hạn dùng và số lượt.
async function checkVoucher(code: string, subtotal: number): Promise<VoucherCheck> {
  const session = await getSession()
  const verdict = await validateVoucher(code, subtotal, session?.userId)
  if (!verdict.ok) return { applicable: false, discount: 0, message: 'Tạm thời chưa áp dụng được mã giảm giá. Vui lòng thử lại sau.' }
  const { valid, discountAmount, description, firstOnlineOrderOnly } = verdict.data
  if (!valid) return { applicable: false, discount: 0, message: description }
  if (firstOnlineOrderOnly && (!session || !(await isFirstOnlineOrderAvailable(session.userId)))) {
    return { applicable: false, discount: 0, message: 'Mã chỉ dùng cho đơn online đầu tiên của tài khoản.' }
  }
  return { applicable: true, discount: discountAmount, message: description || `Đã áp dụng mã ${normalizeVoucherCode(code)}.` }
}

function cartSubtotal(lines: Cart['lines']['nodes']): number {
  return lines.reduce((sum, line) => sum + Number(line.merchandise.price.amount) * line.quantity, 0)
}

/** Kiểm tra lại mã đang áp trên tạm tính hiện tại (đơn tối thiểu, hạn, lượt có thể đã đổi) và tính lại tổng. */
async function refreshVoucher(cart: Cart | null): Promise<VoucherCheck | null> {
  if (!cart || isShopifyConfigured) return null
  let check: VoucherCheck | null = null
  for (const code of cart.discountCodes) {
    check = await checkVoucher(code.code, cartSubtotal(cart.lines.nodes))
    code.applicable = check.applicable
  }
  cart.cost = calculateCost(cart.lines.nodes, check?.applicable ? check.discount : 0)
  return check
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

function calculateCost(lines: Cart['lines']['nodes'], discount: number) {
  const subtotal = cartSubtotal(lines)
  const total = subtotal - Math.min(subtotal, discount)
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
    const cart = await currentCart()
    await refreshVoucher(cart)
    return NextResponse.json(cart)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  if (request.headers.get('sec-fetch-site') !== 'same-origin' && request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  }
  // Chỉ khách đã đăng nhập mới được đặt món: đơn, điểm và lịch sử của nó thuộc về một tài khoản.
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập để đặt món.', loginRequired: true }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Xử lý chế độ demo khi chưa cấu hình Shopify
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
        // Giá và tình trạng còn bán lấy từ thực đơn, không bao giờ lấy từ request.
        const match = await findMenuVariant(String(body.variantId ?? ''))
        if (!match) throw new Error('Choose a valid product.')
        if (!match.variant.availableForSale) throw new Error(`${match.product.title} is sold out right now.`)
        const matchedProduct = match.product
        const matchedVariant = match.variant

        const attributes = Object.entries(body.options ?? {})
          .filter(([k, v]) => OPTION_KEYS.includes(k) && typeof v === 'string' && v.length <= 40)
          .map(([key, value]) => ({ key, value: String(value) }))
        // Cùng đồ uống nhưng khác tùy chọn (sữa, đường, đá) là một dòng riêng, để không mất lựa
        // chọn nào.
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
        const code = normalizeVoucherCode(body.code).slice(0, 30)
        cart.discountCodes = code ? [{ code, applicable: false }] : []
      } else if (body.action === 'note') {
        cart.note = String(body.note ?? '').slice(0, 500)
      } else {
        throw new Error('Unknown cart action.')
      }

      cart.totalQuantity = cart.lines.nodes.reduce((sum, l) => sum + l.quantity, 0)
      const voucher = await refreshVoucher(cart)

      await setLocalCart(cart)
      // voucherMessage cho giỏ hàng biết vì sao mã vừa nhập không dùng được (hết hạn, cần mua thêm...).
      return NextResponse.json(body.action === 'discount' && voucher ? { ...cart, voucherMessage: voucher.message } : cart)
    }

    // Luồng Shopify cho production
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
        const check = await checkVoucher(String(body.code ?? ''), Number(cart.cost.subtotalAmount.amount))
        if (!check.applicable) throw new Error(check.message)
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
