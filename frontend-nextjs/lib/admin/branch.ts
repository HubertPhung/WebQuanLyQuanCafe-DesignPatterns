import 'server-only'
import { cookies } from 'next/headers'
import { DEFAULT_BRANCH_ID, isBranchId, type BranchId } from '@/lib/branches'

export const ADMIN_BRANCH_COOKIE = 'admin_branch'

// The branch the admin console is looking at, chosen in the header; every list, the POS and
// the reports follow it.
export async function getAdminBranch(): Promise<BranchId> {
  try {
    const value = (await cookies()).get(ADMIN_BRANCH_COOKIE)?.value
    return isBranchId(value) ? value : DEFAULT_BRANCH_ID
  } catch {
    // Outside a request (scripts, tests) there is no cookie jar.
    return DEFAULT_BRANCH_ID
  }
}
