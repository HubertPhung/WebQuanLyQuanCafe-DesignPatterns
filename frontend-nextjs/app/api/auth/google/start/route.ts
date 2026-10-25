import { NextRequest, NextResponse } from 'next/server'
import { authorizeUrl, googleConfig, OAUTH_COOKIE, pkceChallenge, randomToken, redirectUri } from '@/lib/auth/google'
import { safeNext } from '@/lib/auth/roles'

// GET /api/auth/google/start?next=/admin: đưa trình duyệt tới màn hình xin quyền của Google.
export async function GET(request: NextRequest) {
  const config = googleConfig()
  if (!config) return NextResponse.redirect(new URL('/login?error=google_not_configured', request.url))

  const state = randomToken()
  const nonce = randomToken()
  const verifier = randomToken()
  const next = safeNext(request.nextUrl.searchParams.get('next')) ?? ''
  const response = NextResponse.redirect(
    authorizeUrl(config, { redirectUri: redirectUri(request.nextUrl.origin), state, nonce, challenge: await pkceChallenge(verifier) }),
  )
  // Tồn tại ngắn, httpOnly: callback so khớp state và dùng lại nonce cùng PKCE verifier.
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, nonce, verifier, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/google',
    maxAge: 600,
  })
  return response
}
