'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Edit,
  KeyRound,
  Lock,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  UserCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type UserRole = 'manager' | 'staff' | 'customer'
export type UserStatus = 'active' | 'locked'

export type AppUser = {
  id: string
  name: string
  initials: string
  email: string
  phone: string
  role: UserRole
  roleTitle: string
  status: UserStatus
  monthlySalary?: number // VND cho nhân viên
  loyaltyPoints?: number // Điểm cho khách hàng
  joinedDate: string
}

const initialUsers: AppUser[] = [
  // 5 Nhân viên
  {
    id: 'NV-001',
    name: 'Nguyễn Hoàng Long',
    initials: 'HL',
    email: 'hoanglong@dalatcafe.vn',
    phone: '0903 123 456',
    role: 'manager',
    roleTitle: 'Quản lý / Trưởng Barista',
    status: 'active',
    monthlySalary: 15000000,
    joinedDate: '15/01/2024',
  },
  {
    id: 'NV-002',
    name: 'Trần Mai Phương',
    initials: 'MP',
    email: 'maiphuong@dalatcafe.vn',
    phone: '0912 234 567',
    role: 'staff',
    roleTitle: 'Giám sát ca trực',
    status: 'active',
    monthlySalary: 12000000,
    joinedDate: '01/03/2024',
  },
  {
    id: 'NV-003',
    name: 'Lê Anh Tuấn',
    initials: 'AT',
    email: 'anhtuan@dalatcafe.vn',
    phone: '0988 345 678',
    role: 'staff',
    roleTitle: 'Barista cao cấp (Pha tay)',
    status: 'active',
    monthlySalary: 10500000,
    joinedDate: '10/05/2024',
  },
  {
    id: 'NV-004',
    name: 'Phạm Quỳnh Anh',
    initials: 'QA',
    email: 'quynhanh@dalatcafe.vn',
    phone: '0977 456 789',
    role: 'staff',
    roleTitle: 'Thu ngân quầy & Order',
    status: 'active',
    monthlySalary: 9000000,
    joinedDate: '20/06/2024',
  },
  {
    id: 'NV-005',
    name: 'Đặng Minh Khang',
    initials: 'MK',
    email: 'minhkhang@dalatcafe.vn',
    phone: '0933 567 890',
    role: 'staff',
    roleTitle: 'Barista pha chế Cold Brew',
    status: 'active',
    monthlySalary: 9500000,
    joinedDate: '12/08/2024',
  },

  // 5 Khách hàng
  {
    id: 'KH-001',
    name: 'Trần Hoài Nam',
    initials: 'HN',
    email: 'nam.tran@gmail.com',
    phone: '0908 111 222',
    role: 'customer',
    roleTitle: 'Thành viên Vàng',
    status: 'active',
    loyaltyPoints: 680,
    joinedDate: '05/02/2024',
  },
  {
    id: 'KH-002',
    name: 'Nguyễn Thị Hương',
    initials: 'TH',
    email: 'huong.nguyen@gmail.com',
    phone: '0918 333 444',
    role: 'customer',
    roleTitle: 'Thành viên Bạc',
    status: 'active',
    loyaltyPoints: 420,
    joinedDate: '18/03/2024',
  },
  {
    id: 'KH-003',
    name: 'Lê Bảo Anh',
    initials: 'BA',
    email: 'baoanh.le@gmail.com',
    phone: '0975 666 777',
    role: 'customer',
    roleTitle: 'Thành viên Kim Cương',
    status: 'active',
    loyaltyPoints: 1250,
    joinedDate: '10/01/2024',
  },
  {
    id: 'KH-004',
    name: 'Phạm Hoàng My',
    initials: 'HM',
    email: 'hoangmy.pham@gmail.com',
    phone: '0938 888 999',
    role: 'customer',
    roleTitle: 'Thành viên Đồng',
    status: 'active',
    loyaltyPoints: 150,
    joinedDate: '24/07/2024',
  },
  {
    id: 'KH-005',
    name: 'Đỗ Minh Quân',
    initials: 'MQ',
    email: 'minhquan.do@gmail.com',
    phone: '0909 555 666',
    role: 'customer',
    roleTitle: 'Thành viên Vàng',
    status: 'active',
    loyaltyPoints: 790,
    joinedDate: '03/04/2024',
  },
]

export function StaffManagement() {
  const [users, setUsers] = useState<AppUser[]>(initialUsers)
  const [activeTab, setActiveTab] = useState<'all' | 'staff' | 'customer'>('all')
  const [search, setSearch] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)

  // Form State cho thêm người dùng mới
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formRole, setFormRole] = useState<UserRole>('staff')
  const [formRoleTitle, setFormRoleTitle] = useState('')
  const [formSalaryOrPoints, setFormSalaryOrPoints] = useState('')

  // KPI Metrics tính toán động
  const totalUsers = users.length
  const totalStaff = users.filter((u) => u.role === 'manager' || u.role === 'staff').length
  const totalCustomers = users.filter((u) => u.role === 'customer').length
  const totalActive = users.filter((u) => u.status === 'active').length

  const filteredUsers = users.filter((user) => {
    const matchTab =
      activeTab === 'all'
        ? true
        : activeTab === 'staff'
        ? user.role === 'manager' || user.role === 'staff'
        : user.role === 'customer'

    const q = search.toLowerCase().trim()
    const matchSearch =
      !q ||
      user.name.toLowerCase().includes(q) ||
      user.id.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      user.phone.includes(q) ||
      user.roleTitle.toLowerCase().includes(q)

    return matchTab && matchSearch
  })

  // Toggle Khóa / Mở khóa tài khoản
  function handleToggleLock(id: string) {
    setUsers((curr) =>
      curr.map((u) => {
        if (u.id !== id) return u
        const nextStatus: UserStatus = u.status === 'active' ? 'locked' : 'active'
        return { ...u, status: nextStatus }
      })
    )
  }

  // Thêm người dùng mới
  function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim() || !formEmail.trim()) return

    const isStaffOrManager = formRole === 'manager' || formRole === 'staff'
    const newId = isStaffOrManager
      ? `NV-${String(totalStaff + 1).padStart(3, '0')}`
      : `KH-${String(totalCustomers + 1).padStart(3, '0')}`

    const nameParts = formName.trim().split(' ')
    const initials =
      nameParts.length > 1
        ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
        : formName.slice(0, 2).toUpperCase()

    const newUser: AppUser = {
      id: newId,
      name: formName.trim(),
      initials,
      email: formEmail.trim(),
      phone: formPhone.trim() || '0900 000 000',
      role: formRole,
      roleTitle: formRoleTitle.trim() || (isStaffOrManager ? 'Nhân viên phục vụ' : 'Thành viên mới'),
      status: 'active',
      monthlySalary: isStaffOrManager ? Number(formSalaryOrPoints) || 8500000 : undefined,
      loyaltyPoints: !isStaffOrManager ? Number(formSalaryOrPoints) || 0 : undefined,
      joinedDate: new Date().toLocaleDateString('vi-VN'),
    }

    setUsers([newUser, ...users])
    setIsAddModalOpen(false)
    resetAddForm()
  }

  function resetAddForm() {
    setFormName('')
    setFormEmail('')
    setFormPhone('')
    setFormRole('staff')
    setFormRoleTitle('')
    setFormSalaryOrPoints('')
  }

  // Cập nhật người dùng đang chỉnh sửa
  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return

    setUsers((curr) => curr.map((u) => (u.id === editingUser.id ? editingUser : u)))
    setEditingUser(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 4 Thẻ KPI Metrics chính xác theo đặc tả */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border border-stone-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Tổng người dùng</span>
            <Users className="size-4 text-[#5A3E2B]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-stone-900 tabular-nums">{totalUsers}</div>
            <p className="text-xs text-stone-500 mt-1">Bao gồm toàn bộ nhân sự & khách hàng</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-stone-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Nhân viên</span>
            <UserCog className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-blue-600 tabular-nums">{totalStaff}</div>
            <p className="text-xs text-stone-500 mt-1">Quản lý, Barista, Thu ngân & Phục vụ</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-stone-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Khách hàng</span>
            <ShieldCheck className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-emerald-600 tabular-nums">{totalCustomers}</div>
            <p className="text-xs text-stone-500 mt-1">Khách tích điểm & thành viên thân thiết</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-stone-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Đang hoạt động</span>
            <UserCheck className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-emerald-600 flex items-center gap-2 tabular-nums">
              <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
              {totalActive}
            </div>
            <p className="text-xs text-stone-500 mt-1">Tài khoản hợp lệ không bị khóa</p>
          </CardContent>
        </Card>
      </div>

      {/* Thông báo bảo mật hệ thống & Lưu ý PIN */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/80 bg-amber-50/90 p-4 text-xs text-amber-950">
        <div className="flex items-center gap-3">
          <KeyRound className="size-5 text-amber-800 shrink-0" />
          <div>
            <span className="sr-only">Staff accounts arrive with sign-in</span>
            <span className="font-bold text-stone-900">Tài khoản nhân viên tích hợp xác thực mã PIN và đăng nhập bảo mật.</span>
            <p className="text-stone-700 mt-0.5">
              Nhân viên có thể đăng nhập trên máy POS quầy bán và chuyển đổi hồ sơ nhanh chóng thông qua mã PIN 4 chữ số.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-950 font-semibold px-3 py-1 rounded-full">
          123 Phan Đình Phùng
        </Badge>
      </div>

      {/* Thẻ bảng danh sách người dùng */}
      <Card className="rounded-xl border border-stone-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-stone-200/90">
          <div>
            <CardTitle className="text-lg font-bold tracking-tight text-stone-900">Danh sách người dùng & Phân quyền</CardTitle>
            <CardDescription className="text-stone-500 mt-0.5">
              Quản lý chi tiết hồ sơ nhân viên, khách hàng thành viên, mức lương và trạng thái truy cập.
            </CardDescription>
          </div>

          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="h-10 rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold gap-2 px-4 shadow-sm"
          >
            <Plus className="size-4" />
            + Thêm người dùng mới
          </Button>
        </CardHeader>

        <CardContent className="pt-5 flex flex-col gap-4">
          {/* Bộ lọc tab & Thanh tìm kiếm */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-stone-100 border border-stone-200/90 w-fit">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={cn(
                  'px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all',
                  activeTab === 'all'
                    ? 'bg-[#5A3E2B] text-white shadow-xs'
                    : 'text-stone-700 hover:text-stone-950'
                )}
              >
                Tất cả ({totalUsers})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('staff')}
                className={cn(
                  'px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all',
                  activeTab === 'staff'
                    ? 'bg-[#5A3E2B] text-white shadow-xs'
                    : 'text-stone-700 hover:text-stone-950'
                )}
              >
                Nhân viên ({totalStaff})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('customer')}
                className={cn(
                  'px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all',
                  activeTab === 'customer'
                    ? 'bg-[#5A3E2B] text-white shadow-xs'
                    : 'text-stone-700 hover:text-stone-950'
                )}
              >
                Khách hàng ({totalCustomers})
              </button>
            </div>

            <InputGroup className="max-w-xs bg-white border-stone-200 rounded-lg">
              <InputGroupAddon>
                <Search className="size-4 text-stone-400" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Tìm tên, email, SĐT, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-stone-900 placeholder:text-stone-400 truncate"
              />
            </InputGroup>
          </div>

          {/* Bảng danh sách */}
          <div className="rounded-lg border border-stone-200/90 overflow-hidden">
            <Table>
              <TableHeader className="bg-stone-50/60">
                <TableRow className="border-b border-stone-200/90 hover:bg-transparent">
                  <TableHead className="font-semibold text-stone-500 uppercase tracking-wider text-xs">Avatar & Họ tên</TableHead>
                  <TableHead className="font-semibold text-stone-500 uppercase tracking-wider text-xs">Mã ID</TableHead>
                  <TableHead className="font-semibold text-stone-500 uppercase tracking-wider text-xs">Lương tháng / Điểm tích lũy</TableHead>
                  <TableHead className="font-semibold text-stone-500 uppercase tracking-wider text-xs">Email & Số điện thoại</TableHead>
                  <TableHead className="font-semibold text-stone-500 uppercase tracking-wider text-xs">Phân quyền vai trò</TableHead>
                  <TableHead className="font-semibold text-stone-500 uppercase tracking-wider text-xs">Trạng thái</TableHead>
                  <TableHead className="text-right font-semibold text-stone-500 uppercase tracking-wider text-xs">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-stone-400 text-sm">
                      Không tìm thấy người dùng phù hợp với điều kiện tìm kiếm.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const isStaff = user.role === 'manager' || user.role === 'staff'
                    return (
                      <TableRow key={user.id} className="border-b border-stone-200/60 hover:bg-stone-50/60 transition-colors">
                        {/* Avatar & Họ tên */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-9 bg-[#3E2723] text-amber-200 border border-stone-200 font-bold text-xs">
                              <AvatarFallback>{user.initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-bold text-stone-900 text-sm leading-snug">{user.name}</span>
                              <span className="text-[11px] text-stone-500 leading-snug">{user.roleTitle}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Mã ID */}
                        <TableCell className="font-mono text-xs font-semibold text-stone-600 tabular-nums">
                          {user.id}
                        </TableCell>

                        {/* Lương tháng (cho nhân viên) / Điểm tích lũy (cho khách hàng) */}
                        <TableCell className="tabular-nums">
                          {isStaff ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-[#3E2723]">
                                {user.monthlySalary?.toLocaleString('vi-VN')} đ
                              </span>
                              <span className="text-[10px] text-stone-400">Lương cứng / tháng</span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-emerald-700">
                                {user.loyaltyPoints?.toLocaleString('vi-VN')} điểm
                              </span>
                              <span className="text-[10px] text-stone-400">Tích lũy chi tiêu</span>
                            </div>
                          )}
                        </TableCell>

                        {/* Email & Số điện thoại */}
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span className="text-stone-800 font-medium">{user.email}</span>
                            <span className="text-stone-500 font-mono text-[11px] mt-0.5">{user.phone}</span>
                          </div>
                        </TableCell>

                        {/* Phân quyền vai trò (Badge) */}
                        <TableCell>
                          {user.role === 'manager' ? (
                            <Badge className="bg-amber-100 text-amber-950 border border-amber-300 font-bold text-xs px-2.5 py-0.5">
                              Quản lý
                            </Badge>
                          ) : user.role === 'staff' ? (
                            <Badge className="bg-blue-100 text-blue-950 border border-blue-300 font-bold text-xs px-2.5 py-0.5">
                              Nhân viên
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold text-xs px-2.5 py-0.5">
                              Khách hàng
                            </Badge>
                          )}
                        </TableCell>

                        {/* Trạng thái */}
                        <TableCell>
                          {user.status === 'active' ? (
                            <Badge className="bg-emerald-50/90 text-emerald-900 border border-emerald-300/80 text-xs font-bold gap-1.5 px-2.5 py-0.5">
                              <span className="size-1.5 rounded-full bg-emerald-600" />
                              Đang hoạt động
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-50/90 text-rose-950 border border-rose-300/80 text-xs font-bold gap-1.5 px-2.5 py-0.5">
                              <span className="size-1.5 rounded-full bg-rose-600" />
                              Đã khóa
                            </Badge>
                          )}
                        </TableCell>

                        {/* Thao tác Sửa / Khóa tài khoản */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingUser(user)}
                              className="h-8 px-2.5 rounded-lg border-stone-200 bg-white text-stone-700 hover:bg-stone-100 hover:text-stone-900 text-xs gap-1"
                            >
                              <Edit className="size-3.5" />
                              Sửa
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleLock(user.id)}
                              className={cn(
                                'h-8 px-2.5 rounded-lg border text-xs gap-1 font-semibold transition-all',
                                user.status === 'active'
                                  ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              )}
                            >
                              {user.status === 'active' ? (
                                <>
                                  <Lock className="size-3.5" />
                                  Khóa
                                </>
                              ) : (
                                <>
                                  <Unlock className="size-3.5" />
                                  Mở khóa
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal "+ Thêm người dùng mới" */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl border border-stone-200 bg-white p-6 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-lg bg-amber-50 text-[#3E2723] flex items-center justify-center border border-amber-200/60">
                  <Plus className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-stone-900">Thêm người dùng mới</h3>
                  <p className="text-xs text-stone-500">Điền thông tin tài khoản nhân viên hoặc khách hàng</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="mt-5 flex flex-col gap-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-stone-700">Họ và tên *</label>
                  <input
                    required
                    type="text"
                    placeholder="Nguyễn Văn A"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#3E2723] focus:bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-stone-700">Phân quyền vai trò *</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:border-[#3E2723] focus:bg-white"
                  >
                    <option value="manager">Quản lý (Manager)</option>
                    <option value="staff">Nhân viên (Staff)</option>
                    <option value="customer">Khách hàng (Customer)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-stone-700">Địa chỉ Email *</label>
                  <input
                    required
                    type="email"
                    placeholder="example@dalatcafe.vn"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#3E2723] focus:bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-stone-700">Số điện thoại *</label>
                  <input
                    required
                    type="tel"
                    placeholder="0901 234 567"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#3E2723] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-stone-700">Chức vụ / Danh hiệu</label>
                  <input
                    type="text"
                    placeholder={formRole === 'customer' ? 'Thành viên mới' : 'Barista / Thu ngân'}
                    value={formRoleTitle}
                    onChange={(e) => setFormRoleTitle(e.target.value)}
                    className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#3E2723] focus:bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-stone-700">
                    {formRole === 'customer' ? 'Điểm thưởng ban đầu' : 'Mức lương tháng (VND)'}
                  </label>
                  <input
                    type="number"
                    placeholder={formRole === 'customer' ? '0' : '9000000'}
                    value={formSalaryOrPoints}
                    onChange={(e) => setFormSalaryOrPoints(e.target.value)}
                    className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#3E2723] focus:bg-white"
                  />
                </div>
              </div>

              <p className="text-stone-500">Tạo tài khoản đăng nhập và đặt mật khẩu tại mục Tài khoản & phân quyền.</p>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-10 px-4 rounded-lg border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  className="h-10 px-5 rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold"
                >
                  Lưu người dùng
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sửa người dùng */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl border border-stone-200 bg-white p-6 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-lg bg-amber-50 text-[#3E2723] flex items-center justify-center border border-amber-200/60">
                  <Edit className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-stone-900">Chỉnh sửa người dùng</h3>
                  <p className="text-xs text-stone-500">Mã tài khoản: {editingUser.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-5 flex flex-col gap-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-stone-700">Họ và tên *</label>
                  <input
                    required
                    type="text"
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:border-[#3E2723] focus:bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-stone-700">Phân quyền vai trò</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                    className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:border-[#3E2723] focus:bg-white"
                  >
                    <option value="manager">Quản lý (Manager)</option>
                    <option value="staff">Nhân viên (Staff)</option>
                    <option value="customer">Khách hàng (Customer)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-stone-700">Địa chỉ Email</label>
                  <input
                    required
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:border-[#3E2723] focus:bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-stone-700">Số điện thoại</label>
                  <input
                    required
                    type="tel"
                    value={editingUser.phone}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                    className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:border-[#3E2723] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-stone-700">Chức vụ / Danh hiệu</label>
                  <input
                    type="text"
                    value={editingUser.roleTitle}
                    onChange={(e) => setEditingUser({ ...editingUser, roleTitle: e.target.value })}
                    className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:border-[#3E2723] focus:bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-stone-700">
                    {editingUser.role === 'customer' ? 'Điểm thưởng' : 'Mức lương (VND)'}
                  </label>
                  <input
                    type="number"
                    value={editingUser.role === 'customer' ? editingUser.loyaltyPoints ?? 0 : editingUser.monthlySalary ?? 0}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      if (editingUser.role === 'customer') {
                        setEditingUser({ ...editingUser, loyaltyPoints: val })
                      } else {
                        setEditingUser({ ...editingUser, monthlySalary: val })
                      }
                    }}
                    className="h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm text-stone-900 focus:outline-none focus:border-[#3E2723] focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                  className="h-10 px-4 rounded-lg border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  className="h-10 px-5 rounded-lg bg-[#5A3E2B] hover:bg-[#684732] text-white font-bold"
                >
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
