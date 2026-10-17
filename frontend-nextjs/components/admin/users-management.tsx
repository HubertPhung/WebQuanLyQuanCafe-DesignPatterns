'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createAccount, updateAccount } from '@/app/admin/actions'
import type { JavaUser } from '@/lib/api-client'
import { roleLabels, roles } from '@/lib/auth/roles'

const emptyForm = { name: '', email: '', password: '', role: 'STAFF' }

// ADMIN screen: staff accounts with a role, role changes and disabling (PATCH /api/users/{id}).
export function UsersManagement({ users, currentUserId }: { users: JavaUser[]; currentUserId: number }) {
  const router = useRouter()
  const [form, setForm] = useState(emptyForm)
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        toast.success(result.message ?? 'Đã lưu')
        after?.()
      } else {
        toast.error(result.error)
      }
      router.refresh()
    })
  }

  function create(event: React.FormEvent) {
    event.preventDefault()
    run(() => createAccount(form), () => setForm(emptyForm))
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="xl:col-span-2 rounded-xl border border-stone-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-x-auto">
        <Table>
          <TableHeader className="bg-stone-50/60">
            <TableRow>
              <TableHead className="text-xs font-semibold uppercase text-stone-500">Tài khoản</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-stone-500">Vai trò</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-stone-500 text-right">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const self = user.id === currentUserId
              return (
                <TableRow key={user.id} className={user.active ? '' : 'opacity-60'}>
                  <TableCell>
                    <div className="font-semibold text-stone-900">
                      {user.name} {self && <span className="text-xs font-normal text-stone-500">(bạn)</span>}
                    </div>
                    <div className="text-xs text-stone-500 break-all">{user.email}</div>
                  </TableCell>
                  <TableCell>
                    <select
                      aria-label={`Vai trò của ${user.email}`}
                      value={user.role}
                      disabled={pending || self}
                      title={self ? 'Không tự đổi vai trò của chính mình' : undefined}
                      onChange={(event) => run(() => updateAccount(user.id, { role: event.target.value }))}
                      className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-xs font-semibold"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Badge variant={user.active ? 'default' : 'outline'}>{user.active ? 'Hoạt động' : 'Đã khoá'}</Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending || self}
                        onClick={() => run(() => updateAccount(user.id, { active: !user.active }))}
                      >
                        {user.active ? 'Khoá' : 'Mở khoá'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <form
        onSubmit={create}
        className="flex flex-col gap-4 rounded-xl border border-stone-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      >
        <h2 className="text-base font-bold text-stone-900">Tạo tài khoản nhân viên</h2>
        {(['name', 'email', 'password'] as const).map((key) => (
          <div key={key} className="flex flex-col gap-1.5">
            <Label htmlFor={`new-${key}`}>{key === 'name' ? 'Họ và tên' : key === 'email' ? 'Email' : 'Mật khẩu ban đầu'}</Label>
            <Input
              id={`new-${key}`}
              type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'}
              autoComplete={key === 'password' ? 'new-password' : 'off'}
              minLength={key === 'password' ? 8 : undefined}
              required
              value={form[key]}
              onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
            />
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-role">Vai trò</Label>
          <select
            id="new-role"
            value={form.role}
            onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
            className="h-9 rounded-lg border border-stone-200 bg-white px-2 text-sm"
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-stone-500">
          Mật khẩu ít nhất 8 ký tự, có chữ và số. Nhân viên đổi mật khẩu của mình sau khi đăng nhập.
        </p>
        <Button type="submit" disabled={pending} className="bg-[#5A3E2B] text-white hover:bg-[#4a3223]">
          {pending ? 'Đang lưu...' : 'Tạo tài khoản'}
        </Button>
      </form>
    </div>
  )
}
