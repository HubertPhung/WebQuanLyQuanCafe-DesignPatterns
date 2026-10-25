import { jwtVerify } from 'jose'
import { isRole, type Role } from './roles'

// Access token do backend Java cấp (TokenService, HS256) và được kiểm tra ở đây bằng cùng
// AUTH_JWT_SECRET. Không import server-only: proxy.ts cũng dùng file này.

export const SESSION_COOKIE = 'dalatcafe_session'

// Cùng giá trị với AuthSettings.DEV_SECRET bên Java, để chạy local không cần cấu hình gì.
const DEV_SECRET = 'dalatcafe-dev-only-secret-change-me-0123456789'

export type SessionClaims = { userId: number; email: string; name: string; role: Role; expiresAt: number }

let warned = false

/** Khóa bí mật dùng chung, hoặc null ở production khi thiếu (lúc đó đăng nhập bị từ chối). */
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
    return null // sai chữ ký, hết hạn hoặc sai định dạng
  }
}
