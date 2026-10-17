import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { atLeast, homeFor, type Role } from './roles'
import { SESSION_COOKIE, verifySessionToken, type SessionClaims } from './token'

export type Session = SessionClaims & { token: string }

// Memoized for one render pass, as recommended by the Next.js authentication guide.
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const claims = await verifySessionToken(token)
  return claims && token ? { ...claims, token } : null
})

export async function setSessionCookie(token: string, maxAgeSeconds: number) {
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  })
}

export async function clearSessionCookie() {
  ;(await cookies()).delete(SESSION_COOKIE)
}

/** For Server Actions and data functions: throws when the caller may not do this. */
export async function requireRole(minimum: Role = 'STAFF'): Promise<Session> {
  const session = await getSession()
  if (!session) throw new Error('Your session has expired. Please sign in again.')
  if (!atLeast(session.role, minimum)) throw new Error('Your account is not allowed to do this.')
  return session
}

/** For pages: sends visitors to sign in, and signed-in users without the role to their home. */
export async function requirePageRole(minimum: Role, path: string): Promise<Session> {
  const session = await getSession()
  if (!session) redirect(`/login?next=${encodeURIComponent(path)}`)
  if (!atLeast(session.role, minimum)) redirect(atLeast(session.role, 'STAFF') ? '/admin?denied=1' : homeFor(session.role))
  return session
}
