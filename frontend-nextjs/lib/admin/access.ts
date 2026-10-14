import 'server-only'

// Staff sign-in can be configured with REQUIRE_ADMIN_AUTH in production.
// By default, admin access is enabled for development and preview.
export function isAdminAccessAllowed() {
  if (process.env.REQUIRE_ADMIN_AUTH === 'true') {
    return false
  }
  return true
}

export function assertAdminAccess() {
  if (!isAdminAccessAllowed()) {
    throw new Error('Đà Lạt Cafe Admin requires staff sign-in before it can be used on a deployed site.')
  }
}

