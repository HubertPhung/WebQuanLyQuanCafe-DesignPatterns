import { NextRequest, NextResponse } from 'next/server'
import { signInWithGoogle } from '@/lib/api-client'
import { exchangeCode, googleConfig, OAUTH_COOKIE, redirectUri } from '@/lib/auth/google'
import { atLeast, homeFor, isRole, requiredRoleForPath, safeNext } from '@/lib/auth/roles'
import { SESSION_COOKIE, jwtSecret } from '@/lib/auth/token'

function back(request: NextRequest, error: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${error}`, request.url))
  response.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth/google' })
  return response
}

// GET /api/auth/google/callback?code=...&state=...: Google sends the browser back here.
export async function GET(request: NextRequest) {
  const config = googleConfig()
  if (!config) return back(request, 'google_not_configured')
  const params = request.nextUrl.searchParams
  if (params.get('error')) return back(request, 'google_cancelled')

  let saved: { state?: string; nonce?: string; verifier?: string; next?: string }
  try {
    saved = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? '{}')
  } catch {
    saved = {}
  }
  const code = params.get('code')
  if (!code || !saved.state || !saved.nonce || !saved.verifier || params.get('state') !== saved.state) {
    return back(request, 'google_state')
  }

  let identity
  try {
    identity = await exchangeCode(config, {
      code,
      redirectUri: redirectUri(request.nextUrl.origin),
      verifier: saved.verifier,
      nonce: saved.nonce,
    })
  } catch (error) {
    console.warn('Google sign-in failed:', error)
    return back(request, 'google_failed')
  }
  if (!identity.emailVerified) return back(request, 'google_unverified')

  const result = await signInWithGoogle(identity, config.serviceKey)
  if (!result.ok) return back(request, result.unreachable ? 'backend_down' : result.code === 'ACCOUNT_DISABLED' ? 'disabled' : 'google_failed')
  if (!jwtSecret()) return back(request, 'not_configured')

  const role = isRole(result.data.user.role) ? result.data.user.role : 'CUSTOMER'
  const wanted = safeNext(saved.next)
  const needed = wanted ? requiredRoleForPath(new URL(wanted, request.url).pathname) : null
  const target = wanted && (!needed || atLeast(role, needed)) ? wanted : homeFor(role)

  const response = NextResponse.redirect(new URL(target, request.url))
  response.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth/google' })
  response.cookies.set(SESSION_COOKIE, result.data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: result.data.expiresIn,
  })
  return response
}
