// Roles and route rules shared by proxy.ts, server code and client components.
// Mirrors the Java UserRole order: a role includes every permission of the roles before it.

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

// Most specific prefix first. Anything else under /admin needs STAFF.
const adminRules: { prefix: string; minimum: Role }[] = [
  { prefix: '/admin/users', minimum: 'ADMIN' },
  { prefix: '/admin/settings', minimum: 'ADMIN' },
  { prefix: '/admin/analytics', minimum: 'MANAGER' },
  { prefix: '/admin/staff', minimum: 'MANAGER' },
  { prefix: '/admin/schedule', minimum: 'MANAGER' },
]

/** The role a path needs, or null when it is open to everyone. */
export function requiredRoleForPath(pathname: string): Role | null {
  if (pathname === '/account' || pathname.startsWith('/account/')) return 'CUSTOMER'
  if (pathname !== '/admin' && !pathname.startsWith('/admin/')) return null
  return adminRules.find((rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`))?.minimum ?? 'STAFF'
}

/** Where a user lands after signing in when no (allowed) destination was asked for. */
export function homeFor(role: Role) {
  return atLeast(role, 'STAFF') ? '/admin' : '/'
}

/** Only same-site relative paths, so ?next= cannot send people to another site. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
  return next
}
