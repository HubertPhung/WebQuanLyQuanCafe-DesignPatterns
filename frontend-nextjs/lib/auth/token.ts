import { jwtVerify } from 'jose'
import { isRole, type Role } from './roles'

// Access tokens are issued by the Java backend (TokenService, HS256) and verified here with
// the same AUTH_JWT_SECRET. No server-only import: proxy.ts uses this file too.

export const SESSION_COOKIE = 'dalatcafe_session'

// Same value as the Java AuthSettings.DEV_SECRET, so a local run works without any setup.
const DEV_SECRET = 'dalatcafe-dev-only-secret-change-me-0123456789'

export type SessionClaims = { userId: number; email: string; name: string; role: Role; expiresAt: number }

let warned = false

/** The shared secret, or null in production when it is missing (sign-in is then refused). */
export function jwtSecret(): Uint8Array | null {
  const secret = process.env.AUTH_JWT_SECRET
  if (secret && secret.length >= 32) return new TextEncoder().encode(secret)
  if (process.env.NODE_ENV === 'production') return null
  if (!warned) {
    console.warn('AUTH_JWT_SECRET is not set: using the development secret. Never do this in production.')
    warned = true
  }
  return new TextEncoder().encode(DEV_SECRET)
}

export async function verifySessionToken(token: string | undefined): Promise<SessionClaims | null> {
  const secret = jwtSecret()
  if (!token || !secret) return null
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    const userId = Number(payload.sub)
    if (!Number.isInteger(userId) || !isRole(payload.role) || typeof payload.exp !== 'number') return null
    return {
      userId,
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      role: payload.role,
      expiresAt: payload.exp,
    }
  } catch {
    return null // bad signature, expired or malformed
  }
}
