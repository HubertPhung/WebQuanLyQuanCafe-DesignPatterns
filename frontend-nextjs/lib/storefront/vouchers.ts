// Các voucher mà VoucherCatalog bên Java bán, tính giá cùng cách (PercentageDiscountStrategy). Dùng
// chung cho giỏ hàng, trang thanh toán và trang tài khoản, để không chỗ nào hứa một mã hay một mức
// giảm mà Java sẽ từ chối. Java vẫn là bên quyết định một mã có áp dụng được không.

export type StorefrontVoucher = { code: string; rate: number; cap: number; title: string; terms: string }

export const VOUCHERS: StorefrontVoucher[] = [
  {
    code: 'WELCOME10',
    rate: 0.1,
    cap: 50_000,
    title: 'Giảm 10% cho đơn hàng',
    terms: 'Giảm tối đa 50.000 đ, chỉ cho đơn online đầu tiên của tài khoản mới. Mỗi tài khoản một lần.',
  },
]

export function findVoucher(code: string | null | undefined): StorefrontVoucher | undefined {
  const wanted = code?.trim().toUpperCase()
  return VOUCHERS.find((voucher) => voucher.code === wanted)
}

/** Mức giảm của mã đã áp dụng trên một tạm tính; mã không tồn tại thì không giảm. */
export function voucherDiscount(subtotal: number, code: string | null | undefined): number {
  const voucher = findVoucher(code)
  return voucher ? Math.min(subtotal * voucher.rate, voucher.cap) : 0
}
