// Voucher đang chạy do admin tạo bên Java (GET /api/vouchers/active), tính giá cùng cách với
// VoucherService (PercentageDiscountStrategy / FixedAmountDiscountStrategy, kèm đơn tối thiểu). Dùng
// chung cho giỏ hàng, trang thanh toán và trang tài khoản, để không chỗ nào hứa một mức giảm khác
// với số Java sẽ trừ. Java vẫn là bên quyết định một mã có áp dụng được không.

export type ActiveVoucher = {
  code: string
  type: 'PERCENT' | 'FIXED'
  value: number
  maxDiscount: number | null
  minOrder: number
  perAccountLimit: number | null
  firstOnlineOrderOnly: boolean
  endDate: string
  description: string | null
}

export function normalizeVoucherCode(code: string | null | undefined): string {
  return String(code ?? '').trim().toUpperCase()
}

export function findVoucher(vouchers: ActiveVoucher[], code: string | null | undefined): ActiveVoucher | undefined {
  const wanted = normalizeVoucherCode(code)
  return wanted ? vouchers.find((voucher) => voucher.code === wanted) : undefined
}

/** Mức giảm của một voucher trên một tạm tính; chưa đạt đơn tối thiểu hoặc không có mã thì không giảm. */
export function voucherDiscount(subtotal: number, voucher: ActiveVoucher | undefined): number {
  if (!voucher || subtotal < voucher.minOrder) return 0
  const raw = voucher.type === 'FIXED'
    ? voucher.value
    : Math.min(subtotal * voucher.value / 100, voucher.maxDiscount ?? Number.POSITIVE_INFINITY)
  return Math.max(0, Math.min(subtotal, raw))
}

export type PosVoucherVerdict = { voucher: ActiveVoucher | undefined; discount: number; error: string | null }

/**
 * Mã nhập ở quầy POS: mức giảm tính trước bằng cùng công thức với Java, kèm lý do khi không dùng
 * được. Quầy không biết tài khoản của khách nên mã chỉ cho online hoặc giới hạn theo tài khoản bị
 * từ chối, như VoucherService. Java vẫn kiểm tra lại khi thanh toán.
 */
export function posVoucherVerdict(vouchers: ActiveVoucher[], code: string, subtotal: number): PosVoucherVerdict {
  if (!normalizeVoucherCode(code)) return { voucher: undefined, discount: 0, error: null }
  const voucher = findVoucher(vouchers, code)
  if (!voucher) return { voucher: undefined, discount: 0, error: 'Mã không tồn tại hoặc đã hết hạn.' }
  if (voucher.firstOnlineOrderOnly || voucher.perAccountLimit) {
    return { voucher: undefined, discount: 0, error: 'Mã này chỉ dùng khi đặt online.' }
  }
  if (subtotal < voucher.minOrder) {
    const money = (value: number) => `${Math.round(value).toLocaleString('vi-VN')} đ`
    return { voucher, discount: 0, error: `Đơn tối thiểu ${money(voucher.minOrder)}, cần mua thêm ${money(voucher.minOrder - subtotal)}.` }
  }
  return { voucher, discount: voucherDiscount(subtotal, voucher), error: null }
}

/** Dòng mô tả ngắn cho khách: mức giảm, đơn tối thiểu và hạn dùng. */
export function voucherTerms(voucher: ActiveVoucher): string {
  const money = (value: number) => `${value.toLocaleString('vi-VN')} đ`
  const parts = [
    voucher.type === 'FIXED' ? `Giảm ${money(voucher.value)}` : `Giảm ${voucher.value}%`
      + (voucher.maxDiscount ? `, tối đa ${money(voucher.maxDiscount)}` : ''),
  ]
  if (voucher.minOrder > 0) parts.push(`đơn từ ${money(voucher.minOrder)}`)
  if (voucher.firstOnlineOrderOnly) parts.push('chỉ cho đơn online đầu tiên')
  if (voucher.perAccountLimit) parts.push(`mỗi tài khoản ${voucher.perAccountLimit} lần`)
  parts.push(`hạn đến ${voucher.endDate.split('-').reverse().join('/')}`)
  return parts.join(' · ')
}
