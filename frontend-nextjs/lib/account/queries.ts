import 'server-only'
import { findCustomerByPhone } from '@/lib/api-client'
import { joinContactOrders } from '@/lib/admin/queries'
import { listContactsForUser } from '@/lib/orders/online-contacts'
import { isFirstOnlineOrderAvailable } from '@/lib/orders/first-online-order'
import type { Session } from '@/lib/auth/session'
import type { Rank } from './loyalty'
import { getAccountReservations, type AccountReservation } from './reservations'

// What /account shows a signed-in customer: their own online orders (admin_order_contacts keeps
// the account that placed each one), their reservations, delivery addresses, and the membership of the
// phone on their latest order, read from Java (members live there).

export type AccountOrder = {
  orderCode: string
  createdAt: string
  items: string
  total: number
  status: 'pending' | 'brewing' | 'ready' | 'completed' | 'cancelled'
  paid: boolean
  refunded: boolean
  fulfilment: 'delivery' | 'pickup'
}

export type AccountAddress = { address: string; phone: string; lastUsed: string }

export type AccountMember = { phone: string; rank: Rank; points: number; totalSpent: number; totalOrders: number }

export type AccountOverview = {
  reservations: AccountReservation[]
  reservationsUnavailable: boolean
  orders: AccountOrder[]
  addresses: AccountAddress[]
  phone: string | null
  member: AccountMember | null
  // Java could not be asked, so whether the phone is a member is unknown.
  memberUnknown: boolean
  welcomeVoucherEligible: boolean
}

export async function getAccountOverview(session: Session): Promise<AccountOverview> {
  const [contacts, welcomeVoucherEligible, reservationHistory] = await Promise.all([
    listContactsForUser(session.userId),
    isFirstOnlineOrderAvailable(session.userId).catch(() => false),
    getAccountReservations(session),
  ])
  const orders = (await joinContactOrders(contacts)).map<AccountOrder>((order) => ({
    orderCode: order.orderCode,
    createdAt: new Date(order.createdAt).toISOString(),
    items: order.items.map((item) => `${item.name} (x${item.qty})`).join(', '),
    total: Number(order.total),
    status: order.status,
    paid: order.paymentStatus === 'paid',
    refunded: order.paymentStatus === 'refunded',
    fulfilment: order.contact.fulfilment,
  }))

  const addresses = new Map<string, AccountAddress>()
  for (const contact of contacts) {
    const address = contact.address?.trim()
    if (contact.fulfilment !== 'delivery' || !address || addresses.has(address.toLowerCase())) continue
    addresses.set(address.toLowerCase(), { address, phone: contact.phone, lastUsed: contact.createdAt.toISOString() })
  }

  // Only paid orders enrol a phone, so the newest phone may not be a member: the newest one that is wins.
  const phones = [...new Set(contacts.map((contact) => contact.phone))].slice(0, 5)
  let member: AccountMember | null = null
  let memberUnknown = false
  for (const phone of phones) {
    const found = await findCustomerByPhone(phone, { asService: true })
    if (!found.ok) {
      memberUnknown = true
      continue
    }
    const customer = found.data[0]
    if (customer) {
      member = { phone, rank: customer.rank, points: customer.loyaltyPoints, totalSpent: customer.totalSpent, totalOrders: customer.totalOrders }
      break
    }
  }
  return {
    ...reservationHistory,
    welcomeVoucherEligible,
    orders,
    addresses: [...addresses.values()],
    phone: member?.phone ?? phones[0] ?? null,
    member,
    memberUnknown: memberUnknown && !member,
  }
}
