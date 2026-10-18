export const DELIVERY_FEE = 10_000

/** Accept Da Lat anywhere in a Vietnamese address, including common city abbreviations. */
export function isDaLatAddress(address: string): boolean {
  const normalized = address.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase()
  return /\bda[\s.-]*lat\b|\bd[\s.]*l\b/.test(normalized)
}

export function shippingFee(fulfilment: string): number {
  return fulfilment === 'delivery' ? DELIVERY_FEE : 0
}
