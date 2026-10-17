'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changePassword, signIn, signUp, type AuthFormState } from '@/app/auth/actions'

function Field({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-stone-700">
        {label}
      </Label>
      <Input id={id} name={id} required {...props} />
    </div>
  )
}

function Feedback({ state }: { state: AuthFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {state.error}
      </p>
    )
  }
  if (state.message) {
    return (
      <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        {state.message}
      </p>
    )
  }
  return null
}

export function GoogleButton({ next, enabled }: { next: string; enabled: boolean }) {
  if (!enabled) {
    return (
      <p className="rounded-lg border border-dashed border-stone-300 px-3 py-2 text-center text-xs text-stone-500">
        Đăng nhập Google chưa được cấu hình (cần GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET và AUTH_SERVICE_KEY).
      </p>
    )
  }
  return (
    <a
      href={`/api/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ''}`}
      className="flex h-10 items-center justify-center gap-2.5 rounded-lg border border-stone-300 bg-white text-sm font-semibold text-stone-800 shadow-2xs transition-colors hover:bg-stone-50"
    >
      <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      Tiếp tục với Google
    </a>
  )
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, {})
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field id="email" label="Email" type="email" autoComplete="email" />
      <Field id="password" label="Mật khẩu" type="password" autoComplete="current-password" />
      <Feedback state={state} />
      <Button type="submit" disabled={pending} className="h-10 bg-[#5A3E2B] text-white hover:bg-[#4a3223]">
        {pending ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </Button>
      <p className="text-center text-sm text-stone-600">
        Chưa có tài khoản?{' '}
        <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-[#5A3E2B] underline-offset-4 hover:underline">
          Tạo tài khoản
        </Link>
      </p>
    </form>
  )
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, {})
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field id="name" label="Họ và tên" autoComplete="name" maxLength={80} />
      <Field id="email" label="Email" type="email" autoComplete="email" />
      <Field id="password" label="Mật khẩu (ít nhất 8 ký tự, có chữ và số)" type="password" autoComplete="new-password" minLength={8} />
      <Field id="confirm" label="Nhập lại mật khẩu" type="password" autoComplete="new-password" minLength={8} />
      <Feedback state={state} />
      <Button type="submit" disabled={pending} className="h-10 bg-[#5A3E2B] text-white hover:bg-[#4a3223]">
        {pending ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
      </Button>
      <p className="text-center text-sm text-stone-600">
        Đã có tài khoản?{' '}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-[#5A3E2B] underline-offset-4 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  )
}

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState(changePassword, {})
  return (
    <form action={action} className="flex flex-col gap-4">
      {hasPassword && <Field id="currentPassword" label="Mật khẩu hiện tại" type="password" autoComplete="current-password" />}
      <Field id="newPassword" label="Mật khẩu mới" type="password" autoComplete="new-password" minLength={8} />
      <Field id="confirm" label="Nhập lại mật khẩu mới" type="password" autoComplete="new-password" minLength={8} />
      <Feedback state={state} />
      <Button type="submit" disabled={pending} variant="outline">
        {pending ? 'Đang lưu...' : hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}
      </Button>
    </form>
  )
}
