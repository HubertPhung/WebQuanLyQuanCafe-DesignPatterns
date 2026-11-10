import assert from 'node:assert/strict'
import {
  posVoucherVerdict,
  rankStorefrontVouchers,
  voucherBenefitSummary,
  voucherDiscount,
  type ActiveVoucher,
} from '../lib/storefront/vouchers'

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

// Danh sách chọn voucher đặt hàng online: xếp hạng mức giảm và gắn nhãn "Giảm nhiều nhất".
const welcome10: ActiveVoucher = {
  ...base,
  code: 'WELCOME10',
  type: 'PERCENT',
  value: 10,
  maxDiscount: 50_000,
  minOrder: 0,
  endDate: '2026-12-31',
}
const giam25k: ActiveVoucher = {
  ...base,
  code: 'GIAM25K',
  type: 'FIXED',
  value: 25_000,
  maxDiscount: null,
  minOrder: 100_000,
  endDate: '2026-11-30',
}
const vip30: ActiveVoucher = {
  ...base,
  code: 'VIP30',
  type: 'PERCENT',
  value: 30,
  maxDiscount: 60_000,
  minOrder: 300_000,
  endDate: '2026-12-15',
}

// Với đơn 150.000đ: WELCOME10 giảm 15.000đ, GIAM25K giảm 25.000đ (nhiều nhất), VIP30 chưa đủ đơn tối thiểu (cần thêm 150.000đ).
const ranked150 = rankStorefrontVouchers([welcome10, giam25k, vip30], 150_000)
assert.equal(ranked150.length, 3)
assert.equal(ranked150[0].voucher.code, 'GIAM25K', 'voucher giảm nhiều nhất được xếp đầu')
assert.equal(ranked150[0].isBest, true, 'GIAM25K được gắn nhãn giảm nhiều nhất')
assert.equal(ranked150[0].discount, 25_000)
assert.equal(ranked150[1].voucher.code, 'WELCOME10')
assert.equal(ranked150[1].isBest, false)
assert.equal(ranked150[1].discount, 15_000)
assert.equal(ranked150[2].voucher.code, 'VIP30')
assert.equal(ranked150[2].eligible, false)
assert.equal(ranked150[2].shortfall, 150_000)
assert.equal(ranked150[2].isBest, false)

// Khi hai mã có cùng số tiền giảm cao nhất, ưu tiên mã hết hạn sớm hơn.
const tieEarly: ActiveVoucher = { ...giam25k, code: 'SOMHON', endDate: '2026-11-15' }
const tieLate: ActiveVoucher = { ...giam25k, code: 'MUONHON', endDate: '2026-12-20' }
const rankedTie = rankStorefrontVouchers([tieLate, tieEarly], 150_000)
assert.equal(rankedTie[0].voucher.code, 'SOMHON')
assert.equal(rankedTie[0].isBest, true)
assert.equal(rankedTie[1].isBest, false)

// Khi giỏ hàng 0đ, không có mã nào được gắn nhãn giảm nhiều nhất.
const rankedZero = rankStorefrontVouchers([welcome10, giam25k], 0)
assert.equal(rankedZero.some((item) => item.isBest), false)

// Định dạng thông tin hiển thị trên từng dòng dropdown.
assert.deepEqual(voucherBenefitSummary(welcome10), {
  discountText: 'Giảm 10%, tối đa 50.000 đ',
  expiryText: 'HSD: 31/12/2026',
  minOrderText: null,
})
assert.deepEqual(voucherBenefitSummary(giam25k), {
  discountText: 'Giảm 25.000 đ',
  expiryText: 'HSD: 30/11/2026',
  minOrderText: 'Đơn từ 100.000 đ',
})

console.log('voucher pricing: all checks passed')
