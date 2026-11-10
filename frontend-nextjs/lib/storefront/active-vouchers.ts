import 'server-only'
import { fetchActiveVouchers } from '@/lib/api-client'
import { isFirstOnlineOrderAvailable } from '@/lib/orders/first-online-order'
import type { ActiveVoucher } from '@/lib/storefront/vouchers'

/**
 * Các mã đang chạy bên Java. Khi có userId, Java lọc mã đã hết lượt theo tài khoản và hàm này
 * lọc tiếp mã chỉ dành cho đơn online đầu tiên nếu tài khoản đã từng đặt đơn.
 */
export async function loadActiveVouchers(userId?: number): Promise<ActiveVoucher[]> {
  const [result, welcomeEligible] = await Promise.all([
    fetchActiveVouchers(userId),
    userId !== undefined ? isFirstOnlineOrderAvailable(userId).catch(() => false) : Promise.resolve(true),
  ])
  if (!result.ok) return []
  if (userId === undefined) return result.data
  return result.data.filter((voucher) => !voucher.firstOnlineOrderOnly || welcomeEligible)
}
