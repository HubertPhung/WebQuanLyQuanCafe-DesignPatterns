import 'server-only'
import { fetchActiveVouchers } from '@/lib/api-client'
import type { ActiveVoucher } from '@/lib/storefront/vouchers'

/**
 * Các mã đang chạy bên Java. Không kết nối được thì trả rỗng: storefront không hứa một mã mà nó
 * không kiểm tra được hạn dùng và số lượt.
 */
export async function loadActiveVouchers(): Promise<ActiveVoucher[]> {
  const result = await fetchActiveVouchers()
  return result.ok ? result.data : []
}
