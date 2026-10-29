import assert from 'node:assert/strict'
import { posVoucherVerdict, voucherDiscount, type ActiveVoucher } from '../lib/storefront/vouchers'

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

// Quầy POS: tính mức giảm từ danh sách mã đang chạy, cùng quy tắc với VoucherService.
const fixed = { ...base, code: 'GIAM20K', type: 'FIXED' as const, value: 20_000, maxDiscount: null, minOrder: 100_000 }
const list: ActiveVoucher[] = [fixed, { ...base, code: 'WELCOME10', perAccountLimit: 1, firstOnlineOrderOnly: true },
  { ...base, code: 'MEMBER5', perAccountLimit: 1 }]
assert.deepEqual(posVoucherVerdict(list, '', 150_000), { voucher: undefined, discount: 0, error: null }, 'no code')
assert.equal(posVoucherVerdict(list, ' giam20k ', 150_000).discount, 20_000, 'codes are normalised')
assert.equal(posVoucherVerdict(list, 'GIAM20K', 150_000).error, null)
assert.equal(posVoucherVerdict(list, 'GIAM20K', 80_000).error, 'Đơn tối thiểu 100.000 đ, cần mua thêm 20.000 đ.')
assert.equal(posVoucherVerdict(list, 'GIAM20K', 80_000).discount, 0)
assert.equal(posVoucherVerdict(list, 'KHONGCO', 150_000).error, 'Mã không tồn tại hoặc đã hết hạn.')
assert.equal(posVoucherVerdict(list, 'WELCOME10', 150_000).error, 'Mã này chỉ dùng khi đặt online.')
assert.equal(posVoucherVerdict(list, 'MEMBER5', 150_000).error, 'Mã này chỉ dùng khi đặt online.')

console.log('voucher pricing: all checks passed')
