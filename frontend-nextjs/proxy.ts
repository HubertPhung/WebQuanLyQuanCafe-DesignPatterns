import { NextResponse, type NextRequest } from 'next/server'
import { atLeast, homeFor, requiredRoleForPath } from '@/lib/auth/roles'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/token'

// Chỉ kiểm tra sơ bộ (theo hướng dẫn xác thực của Next.js): khách không có phiên hợp lệ được đưa
// tới /login, người đã đăng nhập nhưng không đủ vai trò về trang chủ của họ. Mọi hàm dữ liệu admin
// và Server Action đều kiểm tra lại phiên, và backend Java tự kiểm tra token.
export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)

  if (pathname === '/login' || pathname === '/register') {
    return session ? NextResponse.redirect(new URL(homeFor(session.role), request.url)) : NextResponse.next()
  }

  const needed = requiredRoleForPath(pathname)
  if (!needed) return NextResponse.next()
  if (!session) {
    const login = new URL('/login', request.url)
    login.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(login)
  }
  if (!atLeast(session.role, needed)) {
    const home = atLeast(session.role, 'STAFF') ? '/admin?denied=1' : homeFor(session.role)
    return NextResponse.redirect(new URL(home, request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/login', '/register'],
}
