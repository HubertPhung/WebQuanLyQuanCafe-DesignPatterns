'use server'

import { redirect } from 'next/navigation'
import { changeOwnPassword, registerAccount, signInWithPassword, type JavaResult, type JavaSession } from '@/lib/api-client'
import { atLeast, homeFor, isRole, requiredRoleForPath, safeNext } from '@/lib/auth/roles'
import { clearSessionCookie, getSession, setSessionCookie } from '@/lib/auth/session'
import { jwtSecret } from '@/lib/auth/token'

export type AuthFormState = { error?: string; message?: string }

// Accounts live in the Java backend; this layer only keeps its token in an httpOnly cookie.
function failure(result: Extract<JavaResult<unknown>, { ok: false }>): AuthFormState {
  if (result.unreachable) return { error: 'Máy chủ đăng nhập (Java) không phản hồi. Vui lòng thử lại sau.' }
  switch (result.code) {
    case 'INVALID_CREDENTIALS':
      return { error: 'Email hoặc mật khẩu không đúng.' }
    case 'TOO_MANY_ATTEMPTS':
      return { error: 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' }
    case 'ACCOUNT_DISABLED':
      return { error: 'Tài khoản đã bị khoá. Liên hệ quản trị viên.' }
    case 'EMAIL_TAKEN':
      return { error: 'Email này đã có tài khoản. Hãy đăng nhập.' }
    default:
      return { error: result.error }
  }
}

/** Where to go after signing in: the requested page when the role allows it, else the role's home. */
function destination(session: JavaSession, next: string | null) {
  const role = isRole(session.user.role) ? session.user.role : 'CUSTOMER'
  const wanted = safeNext(next)
  const needed = wanted ? requiredRoleForPath(new URL(wanted, 'http://local').pathname) : null
  if (wanted && (!needed || atLeast(role, needed))) return wanted
  return homeFor(role)
}

async function startSession(result: JavaResult<JavaSession>, next: string | null): Promise<AuthFormState> {
  if (!result.ok) return failure(result)
  if (!jwtSecret()) return { error: 'Máy chủ chưa cấu hình AUTH_JWT_SECRET nên chưa thể đăng nhập.' }
  await setSessionCookie(result.data.token, result.data.expiresIn)
  redirect(destination(result.data, next))
}

function text(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value : ''
}

export async function signIn(_state: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = text(form, 'email').trim()
  const password = text(form, 'password')
  if (!email || !password) return { error: 'Nhập email và mật khẩu.' }
  return startSession(await signInWithPassword(email, password), text(form, 'next') || null)
}

export async function signUp(_state: AuthFormState, form: FormData): Promise<AuthFormState> {
  const name = text(form, 'name').trim()
  const email = text(form, 'email').trim()
  const password = text(form, 'password')
  if (!name || !email || !password) return { error: 'Điền đủ họ tên, email và mật khẩu.' }
  if (password !== text(form, 'confirm')) return { error: 'Hai mật khẩu không khớp.' }
  if (password.length < 8 || !/[A-Za-zÀ-ỹ]/.test(password) || !/\d/.test(password)) {
    return { error: 'Mật khẩu cần ít nhất 8 ký tự, gồm cả chữ và số.' }
  }
  return startSession(await registerAccount({ name, email, password }), text(form, 'next') || null)
}

export async function signOut() {
  await clearSessionCookie()
  redirect('/login')
}

export async function changePassword(_state: AuthFormState, form: FormData): Promise<AuthFormState> {
  if (!(await getSession())) redirect('/login?next=/account/security')
  const next = text(form, 'newPassword')
  if (next !== text(form, 'confirm')) return { error: 'Hai mật khẩu mới không khớp.' }
  const result = await changeOwnPassword(text(form, 'currentPassword'), next)
  if (!result.ok) {
    return !result.unreachable && result.code === 'INVALID_CREDENTIALS'
      ? { error: 'Mật khẩu hiện tại không đúng.' }
      : failure(result)
  }
  return { message: 'Đã đổi mật khẩu.' }
}
