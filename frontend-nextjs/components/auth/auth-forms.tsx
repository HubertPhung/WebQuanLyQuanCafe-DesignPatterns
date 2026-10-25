'use client'

import { useActionState, useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { changePassword, signIn, signUp, type AuthFormState } from '@/app/auth/actions'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

const inputClass =
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 text-base text-stone-900 shadow-2xs transition-[border-color,box-shadow] duration-200 placeholder:text-stone-400 focus:border-[#5A3E2B] focus:outline-none focus:ring-4 focus:ring-amber-600/15 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-rose-500/15 sm:text-sm'

// Các ô nhập lần lượt hiện dần khi thẻ xuất hiện.
const list = { shown: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } } }
const item = { hidden: { opacity: 0, y: 8 }, shown: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } } }

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          id={id}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600"
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

function TextField({ label, name, hint, ...props }: { label: string; name: string; hint?: string } & React.ComponentProps<'input'>) {
  const id = useId()
  return (
    <motion.div variants={item}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-stone-700">
        {label}
      </label>
      <input id={id} name={name} required className={inputClass} {...props} />
      {hint && <p className="mt-1.5 text-xs text-stone-500">{hint}</p>}
    </motion.div>
  )
}

function PasswordField({
  label,
  name,
  error,
  children,
  ...props
}: { label: string; name: string; error?: string; children?: React.ReactNode } & React.ComponentProps<'input'>) {
  const id = useId()
  const errorId = `${id}-error`
  const [visible, setVisible] = useState(false)
  return (
    <motion.div variants={item}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-stone-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${inputClass} pr-12`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-xl text-stone-500 transition-colors hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
        >
          {visible ? <EyeOff className="size-4.5" aria-hidden="true" /> : <Eye className="size-4.5" aria-hidden="true" />}
        </button>
      </div>
      {children}
      <FieldError id={errorId} message={error} />
    </motion.div>
  )
}

// Cùng quy tắc với backend Java (từ 8 ký tự, có chữ cái và chữ số), cộng thêm hai điểm thưởng.
function strength(password: string) {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Za-zÀ-ỹ]/.test(password) && /\d/.test(password)) score++
  if (/[a-zà-ỹ]/.test(password) && /[A-ZÀ-Ỹ]/.test(password)) score++
  if (password.length >= 12 || /[^A-Za-z0-9À-ỹ]/.test(password)) score++
  return score
}

const strengthLabels = ['Quá ngắn', 'Yếu', 'Tạm được', 'Khá', 'Mạnh']
const strengthColors = ['bg-stone-300', 'bg-rose-500', 'bg-amber-500', 'bg-lime-600', 'bg-emerald-600']

function StrengthMeter({ password }: { password: string }) {
  const score = strength(password)
  if (!password) return null
  return (
    <div className="mt-2" aria-live="polite">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="h-1.5 overflow-hidden rounded-full bg-stone-200">
            <motion.div
              className={`h-full origin-left rounded-full ${strengthColors[score]}`}
              initial={false}
              animate={{ scaleX: score >= step ? 1 : 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            />
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-stone-500">
        Độ mạnh: <span className="font-semibold text-stone-700">{strengthLabels[score]}</span>
      </p>
    </div>
  )
}

function Feedback({ state }: { state: AuthFormState }) {
  const message = state.error ?? state.message
  return (
    <AnimatePresence initial={false} mode="wait">
      {message && (
        <motion.div
          key={message}
          role={state.error ? 'alert' : 'status'}
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          className={`flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm ${
            state.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {state.error ? (
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SubmitButton({ pending, idle, busy }: { pending: boolean; idle: string; busy: string }) {
  return (
    <motion.button
      variants={item}
      type="submit"
      disabled={pending}
      whileHover={pending ? undefined : { y: -1 }}
      whileTap={pending ? undefined : { scale: 0.98 }}
      className="group relative flex h-11 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#3E2723] via-[#5A3E2B] to-[#3E2723] text-sm font-bold text-white shadow-[0_6px_16px_rgba(62,39,35,0.25)] transition-colors duration-200 hover:bg-[#5A3E2B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-600/30 disabled:cursor-wait disabled:opacity-80"
    >
      {/* Vệt sáng lướt qua khi rê chuột */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[400%] motion-reduce:hidden"
      />
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {busy}
        </>
      ) : (
        <>
          {idle}
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
        </>
      )}
    </motion.button>
  )
}

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState(signIn, notice ? { error: notice } : {})
  return (
    <motion.form action={action} initial="hidden" animate="shown" variants={list} className="flex flex-col gap-4" noValidate={false}>
      <input type="hidden" name="next" value={next} />
      <TextField label="Email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="ban@example.com" />
      <PasswordField label="Mật khẩu" name="password" autoComplete="current-password" />
      <Feedback state={state} />
      <SubmitButton pending={pending} idle="Đăng nhập" busy="Đang đăng nhập..." />
    </motion.form>
  )
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, {})
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const mismatch = confirm.length > 0 && confirm !== password ? 'Hai mật khẩu chưa khớp' : undefined
  return (
    <motion.form action={action} initial="hidden" animate="shown" variants={list} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <TextField label="Họ và tên" name="name" autoComplete="name" maxLength={80} placeholder="Nguyễn Văn An" />
      <TextField label="Email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="ban@example.com" />
      <PasswordField
        label="Mật khẩu"
        name="password"
        autoComplete="new-password"
        minLength={8}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      >
        <StrengthMeter password={password} />
      </PasswordField>
      <PasswordField
        label="Nhập lại mật khẩu"
        name="confirm"
        autoComplete="new-password"
        minLength={8}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        error={mismatch}
      />
      <motion.p variants={item} className="text-xs text-stone-500">
        Ít nhất 8 ký tự, gồm cả chữ và số. Tài khoản mới là tài khoản khách hàng; tài khoản nhân viên do quản trị viên cấp.
      </motion.p>
      <Feedback state={state} />
      <SubmitButton pending={pending} idle="Tạo tài khoản" busy="Đang tạo tài khoản..." />
    </motion.form>
  )
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, {})
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const mismatch = confirm.length > 0 && confirm !== password ? 'Hai mật khẩu chưa khớp' : undefined
  return (
    <motion.form action={action} initial="hidden" animate="shown" variants={list} className="flex flex-col gap-4">
      <PasswordField label="Mật khẩu hiện tại" name="currentPassword" autoComplete="current-password" required={false}>
        <p className="mt-1.5 text-xs text-stone-500">Bỏ trống nếu bạn đăng nhập bằng Google và chưa đặt mật khẩu.</p>
      </PasswordField>
      <PasswordField
        label="Mật khẩu mới"
        name="newPassword"
        autoComplete="new-password"
        minLength={8}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      >
        <StrengthMeter password={password} />
      </PasswordField>
      <PasswordField
        label="Nhập lại mật khẩu mới"
        name="confirm"
        autoComplete="new-password"
        minLength={8}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        error={mismatch}
      />
      <Feedback state={state} />
      <SubmitButton pending={pending} idle="Đổi mật khẩu" busy="Đang lưu..." />
    </motion.form>
  )
}

// Khách hàng có thể tiếp tục bằng Google; ẩn đi khi server không có Google OAuth client.
export function GoogleSignIn({ next, enabled }: { next: string; enabled: boolean }) {
  if (!enabled) return null
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05, ease: EASE_OUT }}>
      <motion.a
        href={`/api/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ''}`}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        className="flex h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-800 shadow-2xs transition-colors duration-200 hover:border-stone-400 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-600/20"
      >
        <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        Tiếp tục với Google
      </motion.a>
      <div className="my-5 flex items-center gap-3 text-xs font-medium text-stone-400">
        <span className="h-px flex-1 bg-stone-200" />
        hoặc dùng email
        <span className="h-px flex-1 bg-stone-200" />
      </div>
    </motion.div>
  )
}
