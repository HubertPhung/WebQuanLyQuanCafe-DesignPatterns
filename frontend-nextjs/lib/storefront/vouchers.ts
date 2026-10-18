// The vouchers Java's VoucherCatalog sells, priced the same way (PercentageDiscountStrategy).
// Shared by the cart, the checkout page and the account page, so none of them can promise a code
// or a discount that Java would refuse. Java stays the judge of whether a code applies.

export type StorefrontVoucher = { code: string; rate: number; cap: number; title: string; terms: string }

export const VOUCHERS: StorefrontVoucher[] = [
  {
    code: 'WELCOME10',
    rate: 0.1,
    cap: 50_000,
    title: 'Giảm 10% cho đơn hàng',
    terms: 'Giảm tối đa 50.000 đ, áp dụng cho đơn đặt online.',
  },
]

export function findVoucher(code: string | null | undefined): StorefrontVoucher | undefined {
  const wanted = code?.trim().toUpperCase()
  return VOUCHERS.find((voucher) => voucher.code === wanted)
}

/** Discount of the applied code on a subtotal; an unknown code gives none. */
export function voucherDiscount(subtotal: number, code: string | null | undefined): number {
  const voucher = findVoucher(code)
  return voucher ? Math.min(subtotal * voucher.rate, voucher.cap) : 0
}
