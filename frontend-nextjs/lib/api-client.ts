// Typed proxy from Next.js Server Actions to the Java SE backend (docs/API_SPEC.md).
// Every call resolves to a result object instead of throwing, so callers can fall back
// to the local store whenever the backend is unreachable.

const DEFAULT_BACKEND_URL = 'http://localhost:8080'
const REQUEST_TIMEOUT_MS = 2500
// The Java SimpleAuthFilter identifies the caller by the Bearer access token of the signed-in
// user (API_SPEC 1.3) and re-reads the role from the account, so no role is sent from here.
import type { BranchId } from '@/lib/branches'
import { SESSION_COOKIE } from '@/lib/auth/token'
// 5xx codes the backend uses to refuse on purpose rather than crash (API_SPEC 1.2).
const FAIL_CLOSED_CODES = new Set(['DATABASE_UNAVAILABLE'])

export type JavaResult<T> =
  | { ok: true; data: T; message?: string }
  // unreachable: no usable answer (network error, timeout, non-JSON or unexpected 5xx); safe to fall back locally.
  | { ok: false; unreachable: true; error: string }
  // rejected: the backend answered and refused the request (4xx or 503 DATABASE_UNAVAILABLE); do not fall back.
  | { ok: false; unreachable: false; status: number; code: string; error: string }

type Envelope<T> = { ok: boolean; data?: T; message?: string; error?: string; code?: string }

export function getJavaBackendUrl(): string | null {
  const raw = (process.env.JAVA_BACKEND_URL ?? DEFAULT_BACKEND_URL).trim()
  if (!raw || raw.toLowerCase() === 'off') return null
  return raw.replace(/\/+$/, '')
}

// The access token of the current request, when there is one (Server Components, Server
// Actions and Route Handlers); outside a request there is simply no token.
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
  // false for the sign-in calls themselves; a token string to call on behalf of a user just signed in.
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
  // A fail-closed backend refusal (e.g. checkout while its database is down) must reach the
  // cashier: recording it locally would book a payment the backend deliberately did not take.
  if (response.status >= 500 && !FAIL_CLOSED_CODES.has(code)) return { ok: false, unreachable: true, error }
  return { ok: false, unreachable: false, status: response.status, code, error }
}

export type JavaMenuItem = { id: number; name: string; kind: string; sellPrice: number; inStock: boolean }

export function fetchMenu(): Promise<JavaResult<JavaMenuItem[]>> {
  return request<JavaMenuItem[]>('/api/menu', { method: 'GET' })
}

export type JavaTable = {
  id: number; name: string; seats: number; zone: string; branch: BranchId; imageUrl?: string | null
  status: 'available' | 'occupied' | 'reserved' | 'cleaning'; guestCount: number; occupiedSince: string | null
}
// ?branch= limits a list to one branch; without it Java answers for the whole shop.
const branchQuery = (branch?: BranchId) => (branch ? `branch=${encodeURIComponent(branch)}` : '')
export function fetchTables(branch?: BranchId) { return request<JavaTable[]>(`/api/tables${branch ? `?${branchQuery(branch)}` : ''}`, { method: 'GET' }) }
export function fetchReservationTables() { return request<Pick<JavaTable, 'id' | 'name' | 'seats' | 'zone' | 'branch'>[]>('/api/tables/catalog', { method: 'GET', auth: false }) }
// A new table joins `branch`; an edited one keeps the branch it has.
export function saveJavaTable(input: { name: string; seats: number; zone: string; imageUrl: string | null; branch?: BranchId }, id?: number) {
  return request<JavaTable>(id === undefined ? '/api/tables' : `/api/tables/${id}/details`, { method: id === undefined ? 'POST' : 'PUT', body: input })
}
export function deleteJavaTable(id: number) { return request<null>(`/api/tables/${id}`, { method: 'DELETE' }) }

export type CheckoutPayload = {
  // customizations use the Java enum names (SIZE_L, CHEESE_FOAM, WHITE_PEARL), priced by its Decorators.
  lines: { menuItemId: number; qty: number; customizations?: string[] }[]
  customer: string
  tableId: number | null
  orderType: 'dine-in' | 'pickup' | 'delivery'
  paymentMethod: 'cash' | 'qr' | 'card'
  // A registered member: earns points, gets the tier discount and may redeem points.
  customerPhone?: string
  useLoyaltyPoints?: number
  // A paid storefront order signs a new phone up as a member (with this email), so it earns points.
  enrollMember?: boolean
  customerEmail?: string
  // Cash handed over; Java refuses a cash sale it does not cover and returns the change.
  tenderedAmount?: number
  // VoucherCatalog code (Strategy) and a free-text note stored on the Java order.
  voucherCode?: string
  note?: string
  // Pickup and delivery orders name their branch; a table already decides it.
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

// Guests' online orders are placed server to server: Java's SimpleAuthFilter takes the storefront
// key as a STAFF caller on POST /api/checkout and /api/orders/sync only. The visitor's own token
// is left out, since a customer's token would be refused there.
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
  // Java takes the branch from the tables; when sent, the tables must belong to it.
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

// PATCH /api/reservations/{code}/status: confirm or cancel (seating goes through transfer-pos).
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

// POST /api/reservations/{code}/transfer-pos: the Java ReservationToOrderAdapter opens a POS order.
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

// GET /api/customers?phone=...: the POS member lookup.
// With asService, the storefront's key reads one phone (the account page), never the whole list.
export function findCustomerByPhone(phone: string, options: ServiceOption = {}): Promise<JavaResult<JavaCustomer[]>> {
  const service = options.asService ? storefrontService() : undefined
  if (service === null) return Promise.resolve(serviceKeyMissing)
  return request<JavaCustomer[]>(`/api/customers?phone=${encodeURIComponent(phone)}`, { method: 'GET', ...service })
}

export type JavaOrder = { orderCode: string; status: string; paymentStatus: string; total: number; warnings?: string[] }

// PATCH /api/orders/{code}/status: KDS lifecycle; reaching "completed" frees the table for cleaning.
export function updateJavaOrderStatus(code: string, status: string): Promise<JavaResult<JavaOrder>> {
  return request<JavaOrder>(`/api/orders/${encodeURIComponent(code)}/status`, { method: 'PATCH', body: { status } })
}

// POST /api/orders/{code}/pay: settles an unpaid order (e.g. one transferred from a reservation).
export function payJavaOrder(code: string, paymentMethod: string): Promise<JavaResult<JavaOrder>> {
  return request<JavaOrder>(`/api/orders/${encodeURIComponent(code)}/pay`, { method: 'POST', body: { paymentMethod } })
}

export type GroupPaymentInput = { tableIds: number[]; paymentMethod: 'cash' | 'qr' | 'card'; tenderedAmount?: number; expectedTotal?: number }
export type GroupPaymentReceipt = { transactionId: string; tableIds: number[]; total: number; orders: JavaOrder[]; warnings?: string[] }
export function payJavaTables(input: GroupPaymentInput): Promise<JavaResult<GroupPaymentReceipt>> {
  return request<GroupPaymentReceipt>('/api/orders/pay-tables', { method: 'POST', body: input })
}

// Quantities are not tracked: the endpoint only switches an item on or off for sale.
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

// POST /api/orders/sync: imports orders recorded locally while Java was down (no payment is taken).
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

export type VoucherVerdict = { code: string; valid: boolean; discountAmount: number; description: string }

// POST /api/vouchers/validate (public): previews a voucher with the Strategy checkout uses.
export function validateVoucher(code: string, subtotal: number): Promise<JavaResult<VoucherVerdict>> {
  return request<VoucherVerdict>('/api/vouchers/validate', { method: 'POST', body: { code, subtotal } })
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

// GET /api/config: settings held by the SystemConfigManager Singleton.
export function fetchConfig(): Promise<JavaResult<StoreConfig>> {
  return request<StoreConfig>('/api/config', { method: 'GET' })
}

// PUT /api/config (ADMIN)
export function updateConfig(change: StoreConfigChange): Promise<JavaResult<StoreConfig>> {
  return request<StoreConfig>('/api/config', { method: 'PUT', body: change })
}

// ---- accounts (/api/auth, /api/users) ----

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

// Customers only: the frontend verified the Google ID token, and the service key proves this
// call comes from it. Staff accounts are refused (STAFF_PASSWORD_ONLY).
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
