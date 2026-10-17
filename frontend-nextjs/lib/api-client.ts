// Typed proxy from Next.js Server Actions to the Java SE backend (docs/API_SPEC.md).
// Every call resolves to a result object instead of throwing, so callers can fall back
// to the local store whenever the backend is unreachable.

const DEFAULT_BACKEND_URL = 'http://localhost:8080'
const REQUEST_TIMEOUT_MS = 2500
// The Java SimpleAuthFilter gates endpoints by role header (API_SPEC 1.3): POS work needs
// STAFF, creating menu items and analytics need MANAGER.
type JavaRole = 'STAFF' | 'MANAGER' | 'ADMIN'
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

async function request<T>(
  path: string,
  init: { method: string; body?: unknown; role?: JavaRole },
): Promise<JavaResult<T>> {
  const baseUrl = getJavaBackendUrl()
  if (!baseUrl) return { ok: false, unreachable: true, error: 'Java backend is disabled.' }

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-User-Role': init.role ?? 'STAFF',
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

export type JavaMenuItem = { id: number; name: string; kind: string; sellPrice: number; inStock: boolean; stockQty: number }

export function fetchMenu(): Promise<JavaResult<JavaMenuItem[]>> {
  return request<JavaMenuItem[]>('/api/menu', { method: 'GET' })
}

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
}

export type CheckoutReceipt = {
  orderCode: string
  subtotal: number
  discountAmount: number
  vatAmount: number
  finalTotal: number
  paymentStatus: string
  transactionId: string | null
  warnings: string[]
  pointsEarned: number
  pointsRedeemed: number
  pointsDiscountVnd: number
}

export function checkout(payload: CheckoutPayload): Promise<JavaResult<CheckoutReceipt>> {
  return request<CheckoutReceipt>('/api/checkout', { method: 'POST', body: payload })
}

export type TableStatusPayload = { status: string; guestCount: number }

export function updateTable(tableId: number, payload: TableStatusPayload): Promise<JavaResult<null>> {
  return request<null>(`/api/tables/${tableId}`, { method: 'PUT', body: payload })
}

export type ReservationPayload = {
  customer: string
  contact: string
  email?: string
  note?: string
  dateTime: string
  guests: number
  tableId: number
}

export type ReservationReceipt = { id: string; status: string }

export function createReservation(payload: ReservationPayload): Promise<JavaResult<ReservationReceipt>> {
  return request<ReservationReceipt>('/api/reservations', { method: 'POST', body: payload })
}

export type JavaReservation = {
  id: string
  customer: string
  contact: string
  email: string | null
  dateTime: string
  table: string | null
  tableId: number | null
  guests: number
  status: string
  note: string | null
  preOrders: { name: string; qty: number; price: number }[]
}

export function fetchReservations(): Promise<JavaResult<JavaReservation[]>> {
  return request<JavaReservation[]>('/api/reservations', { method: 'GET' })
}

// PATCH /api/reservations/{code}/status: confirm or cancel (seating goes through transfer-pos).
export function updateJavaReservationStatus(code: string, status: 'pending' | 'confirmed' | 'cancelled'): Promise<JavaResult<JavaReservation>> {
  return request<JavaReservation>(`/api/reservations/${encodeURIComponent(code)}/status`, { method: 'PATCH', body: { status } })
}

export type TransferredOrder = {
  orderCode: string
  customer: string
  tableId: number | null
  items: { name: string; qty: number; price: number }[]
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
export function findCustomerByPhone(phone: string): Promise<JavaResult<JavaCustomer[]>> {
  return request<JavaCustomer[]>(`/api/customers?phone=${encodeURIComponent(phone)}`, { method: 'GET' })
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

export type StockPayload = { inStock?: boolean; change?: number; stockQty?: number }

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
  stockQty: number
  unit: string
  lowStockThreshold: number
  recipe?: string
  imageUrl?: string
  variations: { name: string; price: number }[]
}

// POST /api/menu (MANAGER+)
export function createJavaMenuItem(payload: NewJavaMenuItem): Promise<JavaResult<JavaMenuItem>> {
  return request<JavaMenuItem>('/api/menu', { method: 'POST', body: payload, role: 'MANAGER' })
}

export type SyncOrderPayload = {
  orderCode: string
  customer: string
  tableId: number | null
  orderType: string
  paymentMethod: string
  paid: boolean
  status: string
  createdAt: string
  total: number
  lines: { menuItemId?: number; name: string; qty: number; price: number; variation?: string }[]
}

export type SyncResult = {
  created: number
  existing: number
  failed: number
  results: { orderCode: string | null; result: 'created' | 'exists' | 'failed'; error?: string; warnings?: string[] }[]
}

// POST /api/orders/sync: imports orders recorded locally while Java was down (no payment is taken).
export function syncJavaOrders(orders: SyncOrderPayload[]): Promise<JavaResult<SyncResult>> {
  return request<SyncResult>('/api/orders/sync', { method: 'POST', body: { orders } })
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
export function fetchAnalytics(days: number): Promise<JavaResult<JavaAnalytics>> {
  return request<JavaAnalytics>(`/api/analytics/overview?days=${days}`, { method: 'GET', role: 'MANAGER' })
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
  return request<StoreConfig>('/api/config', { method: 'PUT', body: change, role: 'ADMIN' })
}
