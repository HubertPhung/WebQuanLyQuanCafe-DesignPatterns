export const DELIVERY_FEE = 10_000

/**
 * Chấp nhận chữ Đà Lạt ở bất kỳ vị trí nào trong địa chỉ tiếng Việt, kể cả các cách viết tắt thông
 * dụng.
 */
export function isDaLatAddress(address: string): boolean {
  const normalized = address.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase()
  return /\bda[\s.-]*lat\b|\bd[\s.]*l\b/.test(normalized)
}

export function shippingFee(fulfilment: string): number {
  return fulfilment === 'delivery' ? DELIVERY_FEE : 0
}
