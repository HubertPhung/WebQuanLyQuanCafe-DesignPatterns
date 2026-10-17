import 'server-only'
import { requireRole } from '@/lib/auth/session'
import type { Role } from '@/lib/auth/roles'

// Every admin data function and Server Action calls this: proxy.ts only does the optimistic
// redirect, the real check happens next to the data (Next.js authentication guide, DAL).
export async function assertAdminAccess(minimum: Role = 'STAFF') {
  await requireRole(minimum)
}
