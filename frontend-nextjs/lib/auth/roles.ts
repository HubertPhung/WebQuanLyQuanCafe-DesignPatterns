// Vai trò và quy tắc đường dẫn dùng chung cho proxy.ts, code server và component client. Theo đúng
// thứ tự UserRole bên Java: mỗi vai trò có mọi quyền của các vai trò đứng trước.

export const roles = ['CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN'] as const
export type Role = (typeof roles)[number]

export const roleLabels: Record<Role, string> = {
  CUSTOMER: 'Khách hàng',
  STAFF: 'Nhân viên',
  MANAGER: 'Quản lý',
  ADMIN: 'Quản trị viên',
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (roles as readonly string[]).includes(value)
}

export function atLeast(role: Role, minimum: Role) {
  return roles.indexOf(role) >= roles.indexOf(minimum)
}

// Tiền tố cụ thể nhất đứng trước. Mọi đường dẫn khác dưới /admin cần STAFF.
const adminRules: { prefix: string; minimum: Role }[] = [
  { prefix: '/admin/users', minimum: 'ADMIN' },
  { prefix: '/admin/settings', minimum: 'ADMIN' },
  { prefix: '/admin/analytics', minimum: 'MANAGER' },
  { prefix: '/admin/vouchers', minimum: 'MANAGER' },
]

/** Vai trò mà một đường dẫn cần, hoặc null khi ai cũng vào được. */
export function requiredRoleForPath(pathname: string): Role | null {
  if (pathname === '/account' || pathname.startsWith('/account/')) return 'CUSTOMER'
  if (pathname !== '/admin' && !pathname.startsWith('/admin/')) return null
  return adminRules.find((rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`))?.minimum ?? 'STAFF'
}

/** Nơi người dùng tới sau khi đăng nhập khi không yêu cầu trang đích (hợp lệ) nào. */
export function homeFor(role: Role) {
  return atLeast(role, 'STAFF') ? '/admin' : '/'
}

/** Chỉ chấp nhận đường dẫn tương đối cùng trang, để ?next= không đưa người dùng sang trang khác. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/')) return null
  // Phân giải theo cách trình duyệt sẽ làm: tab và xuống dòng bị bỏ, và "\" được coi là "/", nên
  // "/\t/evil.com" và "/\\evil.com" đều nghĩa là "//evil.com".
  const base = 'http://same.site'
  let url: URL
  try {
    url = new URL(next, base)
  } catch {
    return null
  }
  return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : null
}
