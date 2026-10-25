import 'server-only'
import { requireRole } from '@/lib/auth/session'
import type { Role } from '@/lib/auth/roles'

// Mọi hàm dữ liệu admin và Server Action đều gọi hàm này: proxy.ts chỉ chuyển hướng sơ bộ, việc
// kiểm tra thật diễn ra ngay cạnh dữ liệu (theo hướng dẫn xác thực của Next.js, mô hình DAL).
export async function assertAdminAccess(minimum: Role = 'STAFF') {
  await requireRole(minimum)
}
