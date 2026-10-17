// Typed proxy from Next.js Server Actions to the Java SE backend (docs/API_SPEC.md).
// Every call resolves to a result object instead of throwing, so callers can fall back
// to the local store whenever the backend is unreachable.

const DEFAULT_BACKEND_URL = 'http://localhost:8080'
const REQUEST_TIMEOUT_MS = 2500
// The Java SimpleAuthFilter gates POS endpoints by role header (API_SPEC 1.4).
const STAFF_ROLE = 'STAFF'

export type JavaResult<T> =
  | { ok: true; data: T; message?: string }
  // unreachable: no usable answer (network error, timeout, 5xx); safe to fall back locally.
  | { ok: false; unreachable: true; error: string }
  // rejected: the backend answered and refused the request (4xx); do not fall back.
  | { ok: false; unreachable: false; status: number; code: string; error: string }

type Envelope<T> = { ok: boolean; data?: T; message?: string; error?: string; code?: string }

export function getJavaBackendUrl(): string | null {
  const raw = (process.env.JAVA_BACKEND_URL ?? DEFAULT_BACKEND_URL).trim()
  if (!raw || raw.toLowerCase() === 'off') return null
  return raw.replace(/\/+$/, '')
}

async function request<T>(path: string, init: { method: string; body?: unknown }): Promise<JavaResult<T>> {
  const baseUrl = getJavaBackendUrl()
  if (!baseUrl) return { ok: false, unreachable: true, error: 'Java backend is disabled.' }

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-User-Role': STAFF_ROLE,
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
  if (response.status >= 500) return { ok: false, unreachable: true, error }
  return { ok: false, unreachable: false, status: response.status, code: envelope.code ?? 'UNKNOWN', error }
}

export type JavaMenuItem = { id: number; name: string; kind: string; sellPrice: number; inStock: boolean }

export function fetchMenu(): Promise<JavaResult<JavaMenuItem[]>> {
  return request<JavaMenuItem[]>('/api/menu', { method: 'GET' })
}

export type CheckoutPayload = {
  lines: { menuItemId: number; qty: number }[]
  customer: string
  tableId: number | null
  orderType: 'dine-in' | 'pickup' | 'delivery'
  paymentMethod: 'cash' | 'qr' | 'card'
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
