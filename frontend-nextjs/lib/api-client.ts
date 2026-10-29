// Proxy có kiểu từ Server Action của Next.js sang backend Java SE (docs/API_SPEC.md). Mọi lời gọi
// trả về một object kết quả thay vì ném lỗi, để nơi gọi chuyển sang kho cục bộ mỗi khi backend
// không kết nối được.

const DEFAULT_BACKEND_URL = 'http://localhost:8080'
const REQUEST_TIMEOUT_MS = 2500
// SimpleAuthFilter bên Java nhận diện người gọi bằng Bearer access token của người dùng đã đăng
// nhập (API_SPEC 1.3) và đọc lại vai trò từ tài khoản, nên không gửi vai trò từ đây.
import type { BranchId } from '@/lib/branches'
import type { ActiveVoucher } from '@/lib/storefront/vouchers'
import { SESSION_COOKIE } from '@/lib/auth/token'
// Các mã 5xx mà backend dùng để chủ động từ chối chứ không phải do sập (API_SPEC 1.2).
const FAIL_CLOSED_CODES = new Set(['DATABASE_UNAVAILABLE'])

export type JavaResult<T> =
  | { ok: true; data: T; message?: string }
  // unreachable: không có câu trả lời dùng được (lỗi mạng, hết thời gian, không phải JSON hoặc 5xx
  // ngoài dự kiến); an toàn để chuyển sang cục bộ.
  | { ok: false; unreachable: true; error: string }
  // rejected: backend đã trả lời và từ chối request (4xx hoặc 503 DATABASE_UNAVAILABLE); không được
  // chuyển sang cục bộ.
  | { ok: false; unreachable: false; status: number; code: string; error: string }

type Envelope<T> = { ok: boolean; data?: T; message?: string; error?: string; code?: string }

export function getJavaBackendUrl(): string | null {
  const raw = (process.env.JAVA_BACKEND_URL ?? DEFAULT_BACKEND_URL).trim()
  if (!raw || raw.toLowerCase() === 'off') return null
  return raw.replace(/\/+$/, '')
}

// Access token của request hiện tại, nếu có (Server Component, Server Action và Route Handler);
// ngoài request thì đơn giản là không có token.
async function sessionToken(): Promise<string | undefined> {
  try {
    const { cookies } = await import('next/headers')
    return (await cookies()).get(SESSION_COOKIE)?.value
  } catch {
    return undefined
  }
}

type CallOptions = {
  method: string
  body?: unknown
  // false cho chính các lời gọi đăng nhập; một chuỗi token để gọi thay cho người dùng vừa đăng
  // nhập.
  auth?: false | string
  headers?: Record<string, string>
}

async function request<T>(path: string, init: CallOptions): Promise<JavaResult<T>> {
  const baseUrl = getJavaBackendUrl()
  if (!baseUrl) return { ok: false, unreachable: true, error: 'Java backend is disabled.' }
  const token = init.auth === false ? undefined : (init.auth ?? (await sessionToken()))

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    return { ok: false, unreachable: true, error: error instanceof Error ? error.message : 'Network error' }
  }

  let envelope: Envelope<T>
  try {
    envelope = (await response.json()) as Envelope<T>
  } catch {
    return { ok: false, unreachable: true, error: `Unexpected ${response.status} response from Java backend.` }
  }

  if (response.ok && envelope.ok) {
    return { ok: true, data: envelope.data as T, message: envelope.message }
  }
  const error = envelope.error ?? `Java backend answered ${response.status}.`
  const code = envelope.code ?? 'UNKNOWN'
  // Lời từ chối chủ động của backend (ví dụ checkout khi database của nó mất) phải tới được thu
  // ngân: ghi cục bộ sẽ ghi nhận một khoản thanh toán mà backend cố ý không thu.
  if (response.status >= 500 && !FAIL_CLOSED_CODES.has(code)) return { ok: false, unreachable: true, error }
  return { ok: false, unreachable: false, status: response.status, code, error }
}

export type JavaMenuItem = {
  id: number; name: string; category: string; kind: string; unit: string
  sellPrice: number; costPrice: number; inStock: boolean
  recipe: string | null; imageUrl: string | null; variations: { name: string; price: number }[]
}

export function fetchMenu(): Promise<JavaResult<JavaMenuItem[]>> {
  return request<JavaMenuItem[]>('/api/menu', { method: 'GET' })
}

export type JavaTable = {
  id: number; name: string; seats: number; zone: string; branch: BranchId; imageUrl?: string | null
  status: 'available' | 'occupied' | 'reserved' | 'cleaning'; guestCount: number; occupiedSince: string | null
}
// ?branch= giới hạn danh sách trong một chi nhánh; không có thì Java trả lời cho cả quán.
const branchQuery = (branch?: BranchId) => (branch ? `branch=${encodeURIComponent(branch)}` : '')
export function fetchTables(branch?: BranchId) { return request<JavaTable[]>(`/api/tables${branch ? `?${branchQuery(branch)}` : ''}`, { method: 'GET' }) }
export type ReservationTableOption = Pick<JavaTable, 'id' | 'name' | 'seats' | 'zone' | 'branch'> & { available?: boolean }
export function fetchReservationTables(dateTime?: string, branch?: BranchId) {
  const query = new URLSearchParams()
  if (dateTime) query.set('dateTime', dateTime)
  if (branch) query.set('branch', branch)
  return request<ReservationTableOption[]>(`/api/tables/catalog${query.size ? `?${query}` : ''}`, { method: 'GET', auth: false })
}
// Bàn mới vào `branch`; bàn đang sửa giữ nguyên chi nhánh của nó.
export function saveJavaTable(input: { name: string; seats: number; zone: string; imageUrl: string | null; branch?: BranchId }, id?: number) {
  return request<JavaTable>(id === undefined ? '/api/tables' : `/api/tables/${id}/details`, { method: id === undefined ? 'POST' : 'PUT', body: input })
}
export function deleteJavaTable(id: number) { return request<null>(`/api/tables/${id}`, { method: 'DELETE' }) }

export type CheckoutPayload = {
  // customizations dùng tên enum bên Java (SIZE_L, CHEESE_FOAM, WHITE_PEARL), được các Decorator
  // của nó tính giá.
  lines: { menuItemId: number; qty: number; customizations?: string[] }[]
  customer: string
  tableId: number | null
  orderType: 'dine-in' | 'pickup' | 'delivery'
  paymentMethod: 'cash' | 'qr' | 'card'
  // Thành viên đã đăng ký: được cộng điểm, giảm giá theo hạng và có thể đổi điểm.
  customerPhone?: string
  useLoyaltyPoints?: number
  // Đơn storefront đã thanh toán đăng ký số điện thoại mới làm thành viên (kèm email này), để đơn
  // được cộng điểm.
  enrollMember?: boolean
  customerEmail?: string
  // Tiền mặt khách đưa; Java từ chối đơn tiền mặt không đủ và trả về tiền thối.
  tenderedAmount?: number
  // Mã voucher do admin tạo (VoucherService chọn Strategy) và ghi chú tự do lưu trên đơn bên Java.
  voucherCode?: string
  // Tài khoản của khách online, để Java áp giới hạn mỗi tài khoản; chỉ được tin khi gửi kèm service key.
  userId?: number
  note?: string
  // Đơn đến lấy và giao hàng tự ghi chi nhánh; với đơn tại bàn thì bàn đã quyết định.
  branch?: BranchId
}

export type CheckoutReceipt = {
  orderCode: string
  subtotal: number
  discountAmount: number
  vatAmount: number
  finalTotal: number
  changeDue: number
  paymentStatus: string
  transactionId: string | null
  warnings: string[]
  pointsEarned: number
  pointsRedeemed: number
  pointsDiscountVnd: number
}

// Đơn online của khách được đặt theo kiểu server gọi server: SimpleAuthFilter bên Java coi key của
// storefront là một người gọi STAFF, chỉ ở POST /api/checkout và /api/orders/sync. Token của chính
// khách không được gửi, vì token khách hàng sẽ bị từ chối ở đó.
type ServiceOption = { asService?: boolean }

function storefrontService(): Pick<CallOptions, 'auth' | 'headers'> | null {
  const key = process.env.AUTH_SERVICE_KEY?.trim()
  return key ? { auth: false, headers: { 'X-Service-Key': key } } : null
}

const serviceKeyMissing = { ok: false, unreachable: true, error: 'AUTH_SERVICE_KEY is not configured.' } as const

export function checkout(payload: CheckoutPayload, options: ServiceOption = {}): Promise<JavaResult<CheckoutReceipt>> {
  const service = options.asService ? storefrontService() : undefined
  if (service === null) return Promise.resolve(serviceKeyMissing)
  return request<CheckoutReceipt>('/api/checkout', { method: 'POST', body: payload, ...service })
}

export type TableStatusPayload = { status: string; guestCount: number }

export function updateTable(tableId: number, payload: TableStatusPayload): Promise<JavaResult<null>> {
  return request<null>(`/api/tables/${tableId}`, { method: 'PUT', body: payload })
}

export type ReservationPayload = {
  tableIds?: number[]
  customer: string
  contact: string
  email?: string
  note?: string
  dateTime: string
  guests: number
  tableId: number
  // Java lấy chi nhánh từ các bàn; nếu có gửi thì các bàn phải thuộc chi nhánh đó.
  branch?: BranchId
}

export type ReservationReceipt = { id: string; status: string }

export function createReservation(payload: ReservationPayload): Promise<JavaResult<ReservationReceipt>> {
  return request<ReservationReceipt>('/api/reservations', { method: 'POST', body: payload })
}

export type JavaReservation = {
  tableIds?: number[]
  id: string
  customer: string
  contact: string
  email: string | null
  dateTime: string
  table: string | null
  tableId: number | null
  branch: BranchId
  guests: number
  status: string
  note: string | null
  preOrders: { name: string; qty: number; price: number }[]
}

export function fetchReservations(branch?: BranchId): Promise<JavaResult<JavaReservation[]>> {
  return request<JavaReservation[]>(`/api/reservations${branch ? `?${branchQuery(branch)}` : ''}`, { method: 'GET' })
}

/**
 * Lịch sử khách hàng được giới hạn theo tài khoản Java đã xác thực, không bao giờ theo id do client
 * gửi.
 */
export function fetchMyReservations(token: string): Promise<JavaResult<JavaReservation[]>> {
  return request<JavaReservation[]>('/api/reservations/mine', { method: 'GET', auth: token })
}

// PATCH /api/reservations/{code}/status: xác nhận hoặc hủy (nhận bàn đi qua transfer-pos). PUT
// /api/reservations/{code} (STAFF+): sửa phiếu đang chờ hoặc đã xác nhận; chuỗi kiểm tra chạy lại.
export function updateJavaReservation(code: string, payload: ReservationPayload): Promise<JavaResult<JavaReservation>> {
  return request<JavaReservation>(`/api/reservations/${encodeURIComponent(code)}`, { method: 'PUT', body: payload })
}

export function updateJavaReservationStatus(code: string, status: 'pending' | 'confirmed' | 'cancelled'): Promise<JavaResult<JavaReservation>> {
  return request<JavaReservation>(`/api/reservations/${encodeURIComponent(code)}/status`, { method: 'PATCH', body: { status } })
}

export type TransferredOrder = {
  tableIds?: number[]
  orderCode: string
  customer: string
  tableId: number | null
  items: { name: string; qty: number; price: number }[]
  branch?: BranchId
  subtotal: number
  total: number
}

// POST /api/reservations/{code}/transfer-pos: ReservationToOrderAdapter bên Java mở đơn POS.
export function transferReservation(code: string): Promise<JavaResult<TransferredOrder>> {
  return request<TransferredOrder>(`/api/reservations/${encodeURIComponent(code)}/transfer-pos`, { method: 'POST' })
}

export type JavaCustomer = {
  id: number
  name: string
  phone: string
  loyaltyPoints: number
  rank: 'bronze' | 'silver' | 'gold' | 'vip'
  totalOrders: number
  totalSpent: number
}

// GET /api/customers?phone=...: POS tra cứu thành viên. Với asService, key của storefront đọc một
// số điện thoại (trang tài khoản), không bao giờ đọc cả danh sách.
export function findCustomerByPhone(phone: string, options: ServiceOption = {}): Promise<JavaResult<JavaCustomer[]>> {
  const service = options.asService ? storefrontService() : undefined
  if (service === null) return Promise.resolve(serviceKeyMissing)
  return request<JavaCustomer[]>(`/api/customers?phone=${encodeURIComponent(phone)}`, { method: 'GET', ...service })
}

export type JavaOrder = { orderCode: string; status: string; paymentStatus: string; total: number; warnings?: string[] }

// PATCH /api/orders/{code}/status: vòng đời KDS; khi tới "completed" thì bàn được nhả để dọn.
export function updateJavaOrderStatus(code: string, status: string): Promise<JavaResult<JavaOrder>> {
  return request<JavaOrder>(`/api/orders/${encodeURIComponent(code)}/status`, { method: 'PATCH', body: { status } })
}

// POST /api/orders/{code}/pay: thanh toán đơn chưa trả (ví dụ đơn chuyển từ phiếu đặt bàn).
export function payJavaOrder(code: string, paymentMethod: string): Promise<JavaResult<JavaOrder>> {
  return request<JavaOrder>(`/api/orders/${encodeURIComponent(code)}/pay`, { method: 'POST', body: { paymentMethod } })
}

export type GroupPaymentInput = { tableIds: number[]; paymentMethod: 'cash' | 'qr' | 'card'; tenderedAmount?: number; expectedTotal?: number }
export type GroupPaymentReceipt = { transactionId: string; tableIds: number[]; total: number; orders: JavaOrder[]; warnings?: string[] }
export function payJavaTables(input: GroupPaymentInput): Promise<JavaResult<GroupPaymentReceipt>> {
  return request<GroupPaymentReceipt>('/api/orders/pay-tables', { method: 'POST', body: input })
}

// Không theo dõi số lượng: endpoint chỉ bật hoặc tắt bán một món.
export type StockPayload = { inStock: boolean }

// PATCH /api/menu/{id}/stock
export function updateJavaStock(menuItemId: number, payload: StockPayload): Promise<JavaResult<JavaMenuItem>> {
  return request<JavaMenuItem>(`/api/menu/${menuItemId}/stock`, { method: 'PATCH', body: payload })
}

export type NewJavaMenuItem = {
  name: string
  category: string
  kind: string
  sellPrice: number
  costPrice: number
  unit: string
  recipe?: string
  imageUrl?: string
  variations: { name: string; price: number }[]
}

// POST /api/menu (MANAGER+)
export function createJavaMenuItem(payload: NewJavaMenuItem): Promise<JavaResult<JavaMenuItem>> {
  return request<JavaMenuItem>('/api/menu', { method: 'POST', body: payload })
}

// PUT /api/menu/{id} (MANAGER+): thay các trường sửa được; 409 khi tên đã có.
export function updateJavaMenuItem(id: number, payload: NewJavaMenuItem): Promise<JavaResult<JavaMenuItem>> {
  return request<JavaMenuItem>(`/api/menu/${id}`, { method: 'PUT', body: payload })
}

// DELETE /api/menu/{id} (MANAGER+). Đơn cũ giữ nguyên tên và giá lúc bán.
export function deleteJavaMenuItem(id: number): Promise<JavaResult<null>> {
  return request<null>(`/api/menu/${id}`, { method: 'DELETE' })
}

export type SyncOrderPayload = {
  tableIds?: number[]
  orderCode: string
  customer: string
  tableId: number | null
  orderType: string
  paymentMethod: string
  paid: boolean
  status: string
  createdAt: string
  completedAt: string | null
  total: number
  lines: { menuItemId?: number; name: string; qty: number; price: number; variation?: string }[]
  branch?: BranchId
}

export type SyncResult = {
  created: number
  existing: number
  failed: number
  results: { orderCode: string | null; result: 'created' | 'exists' | 'failed'; error?: string; warnings?: string[] }[]
}

// POST /api/orders/sync: nhập các đơn đã ghi cục bộ trong lúc Java ngừng hoạt động (không thu
// tiền).
export function syncJavaOrders(orders: SyncOrderPayload[], options: ServiceOption = {}): Promise<JavaResult<SyncResult>> {
  const service = options.asService ? storefrontService() : undefined
  if (service === null) return Promise.resolve(serviceKeyMissing)
  return request<SyncResult>('/api/orders/sync', { method: 'POST', body: { orders }, ...service })
}

export type JavaAnalytics = {
  revenueToday: number
  revenueYesterday: number
  ordersToday: number
  ordersYesterday: number
  fulfillmentMinutesToday: number
  fulfillmentMinutesYesterday: number
  revenueByDay: { date: string; revenue: number; orders: number }[]
  paymentMix: { cash: number; qr: number; card: number }
  topItems: { name: string; qty: number; revenue: number }[]
  tables: { total: number; occupied: number }
}

// GET /api/analytics/overview (MANAGER)
export function fetchAnalytics(days: number, branch?: BranchId): Promise<JavaResult<JavaAnalytics>> {
  return request<JavaAnalytics>(`/api/analytics/overview?days=${days}${branch ? `&${branchQuery(branch)}` : ''}`, { method: 'GET' })
}

export type JavaCustomerSummary = JavaCustomer & { lastVisit: string | null }

// GET /api/customers
export function fetchCustomers(): Promise<JavaResult<JavaCustomerSummary[]>> {
  return request<JavaCustomerSummary[]>('/api/customers', { method: 'GET' })
}

export type VoucherVerdict = {
  code: string
  valid: boolean
  reason: string
  discountAmount: number
  shortfall: number
  description: string
  firstOnlineOrderOnly: boolean
}

// POST /api/vouchers/validate (công khai): xem trước voucher bằng đúng Strategy mà checkout dùng.
// Java chỉ tin userId (giới hạn mỗi tài khoản) khi storefront gửi kèm service key.
export function validateVoucher(code: string, subtotal: number, userId?: number): Promise<JavaResult<VoucherVerdict>> {
  const service = userId === undefined ? undefined : storefrontService() ?? undefined
  return request<VoucherVerdict>('/api/vouchers/validate', {
    method: 'POST',
    body: service ? { code, subtotal, userId } : { code, subtotal },
    ...(service ?? {}),
  })
}

// GET /api/vouchers/active (công khai): các mã đang chạy, cho giỏ hàng và trang tài khoản.
export function fetchActiveVouchers(): Promise<JavaResult<ActiveVoucher[]>> {
  return request<ActiveVoucher[]>('/api/vouchers/active', { method: 'GET', auth: false })
}

export type VoucherRedemption = { usageId: number; discountAmount: number; code: string }

// POST /api/vouchers/redeem (service key): đơn COD giữ một lượt ngay lúc khách đặt.
export function redeemVoucher(input: { code: string; subtotal: number; userId?: number; orderCode: string }): Promise<JavaResult<VoucherRedemption>> {
  const service = storefrontService()
  if (service === null) return Promise.resolve(serviceKeyMissing)
  return request<VoucherRedemption>('/api/vouchers/redeem', { method: 'POST', body: input, ...service })
}

// POST /api/vouchers/release (service key): trả lượt khi đơn COD không ghi được.
export function releaseVoucher(orderCode: string): Promise<JavaResult<{ released: boolean }>> {
  const service = storefrontService()
  if (service === null) return Promise.resolve(serviceKeyMissing)
  return request<{ released: boolean }>('/api/vouchers/release', { method: 'POST', body: { orderCode }, ...service })
}

export type StoreConfig = {
  storeName: string
  storeAddress: string
  storePhone: string
  openingTime: string
  closingTime: string
  maxReservationGuests: number
  loyaltyRateVndPerPoint: number
  pointRedeemValueVnd: number
  vatRate: number
  autoCancelMinutes: number
}

export type StoreConfigChange = Partial<Omit<StoreConfig, 'vatRate' | 'autoCancelMinutes'>>

// GET /api/config: cài đặt do Singleton SystemConfigManager giữ.
export function fetchConfig(): Promise<JavaResult<StoreConfig>> {
  return request<StoreConfig>('/api/config', { method: 'GET' })
}

// PUT /api/config (ADMIN)
export function updateConfig(change: StoreConfigChange): Promise<JavaResult<StoreConfig>> {
  return request<StoreConfig>('/api/config', { method: 'PUT', body: change })
}

// ---- tài khoản (/api/auth, /api/users) ----

export type JavaRole = 'CUSTOMER' | 'STAFF' | 'MANAGER' | 'ADMIN'

export type JavaUser = {
  id: number
  email: string
  name: string
  role: JavaRole
  active: boolean
  providers?: ('password' | 'google')[]
  createdAt: string | null
  lastLoginAt: string | null
}

export type JavaSession = { token: string; expiresIn: number; user: JavaUser }

export function signInWithPassword(email: string, password: string): Promise<JavaResult<JavaSession>> {
  return request<JavaSession>('/api/auth/login', { method: 'POST', body: { email, password }, auth: false })
}

export function registerAccount(input: { email: string; name: string; password: string }): Promise<JavaResult<JavaSession>> {
  return request<JavaSession>('/api/auth/register', { method: 'POST', body: input, auth: false })
}

// Chỉ dành cho khách hàng: frontend đã kiểm tra Google ID token, và service key chứng minh lời gọi
// này đến từ frontend. Tài khoản nhân viên bị từ chối (STAFF_PASSWORD_ONLY).
export function signInWithGoogle(
  identity: { googleSubject: string; email: string; name: string; emailVerified: boolean },
  serviceKey: string,
): Promise<JavaResult<JavaSession>> {
  return request<JavaSession>('/api/auth/google', {
    method: 'POST',
    body: identity,
    auth: false,
    headers: { 'X-Service-Key': serviceKey },
  })
}

export function changeOwnPassword(currentPassword: string, newPassword: string): Promise<JavaResult<JavaUser>> {
  return request<JavaUser>('/api/auth/password', { method: 'POST', body: { currentPassword, newPassword } })
}

export function fetchUsers(): Promise<JavaResult<JavaUser[]>> {
  return request<JavaUser[]>('/api/users', { method: 'GET' })
}

export function createUser(input: { email: string; name: string; password: string; role: JavaRole }): Promise<JavaResult<JavaUser>> {
  return request<JavaUser>('/api/users', { method: 'POST', body: input })
}

export function updateUser(
  id: number,
  change: { role?: JavaRole; active?: boolean; name?: string; password?: string },
): Promise<JavaResult<JavaUser>> {
  return request<JavaUser>(`/api/users/${id}`, { method: 'PATCH', body: change })
}
