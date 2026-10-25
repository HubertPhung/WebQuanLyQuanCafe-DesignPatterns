import 'server-only'
import { cookies } from 'next/headers'
import { DEFAULT_BRANCH_ID, isBranchId, type BranchId } from '@/lib/branches'

export const ADMIN_BRANCH_COOKIE = 'admin_branch'

// Chi nhánh mà trang admin đang xem, chọn ở header; mọi danh sách, POS và báo cáo đều theo nó.
export async function getAdminBranch(): Promise<BranchId> {
  try {
    const value = (await cookies()).get(ADMIN_BRANCH_COOKIE)?.value
    return isBranchId(value) ? value : DEFAULT_BRANCH_ID
  } catch {
    // Ngoài một request (script, test) thì không có cookie.
    return DEFAULT_BRANCH_ID
  }
}
