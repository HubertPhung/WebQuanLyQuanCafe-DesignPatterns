import assert from 'node:assert/strict'
import { voucherDiscount, type ActiveVoucher } from '../lib/storefront/vouchers'

// Cùng các ca với VoucherServiceTest bên Java: giỏ hàng phải hứa đúng số tiền mà checkout sẽ trừ.
const base: ActiveVoucher = {
  code: 'SALE',
  type: 'PERCENT',
  value: 20,
  maxDiscount: 30_000,
  minOrder: 0,
  perAccountLimit: null,
  firstOnlineOrderOnly: false,
  endDate: '2099-12-31',
  description: 'Giảm 20%',
}

assert.equal(voucherDiscount(200_000, base), 30_000, 'percent respects its cap')
assert.equal(voucherDiscount(100_000, base), 20_000, 'percent under the cap')
assert.equal(voucherDiscount(100_000, { ...base, maxDiscount: null }), 20_000, 'percent without a cap')
assert.equal(voucherDiscount(40_000, { ...base, type: 'FIXED', value: 50_000, maxDiscount: null }), 40_000, 'fixed never exceeds the subtotal')
assert.equal(voucherDiscount(120_000, { ...base, minOrder: 150_000 }), 0, 'below the minimum order')
assert.equal(voucherDiscount(150_000, { ...base, minOrder: 150_000 }), 30_000, 'exactly the minimum order')
assert.equal(voucherDiscount(100_000, undefined), 0, 'no voucher')

console.log('voucher pricing: all checks passed')
