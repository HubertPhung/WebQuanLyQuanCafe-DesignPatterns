// Tùy chỉnh dòng món ở POS. Id và phụ thu khớp với các Decorator bên Java (LargeSizeDecorator,
// CheeseFoamDecorator, PearlToppingDecorator) để giá hiện ở quầy khớp với giá backend tính cho POST
// /api/checkout.

export const posCustomizations = [
  { id: 'SIZE_L', label: 'Size L', price: 10000 },
  { id: 'CHEESE_FOAM', label: 'Kem cheese', price: 15000 },
  { id: 'WHITE_PEARL', label: 'Trân châu trắng', price: 10000 },
] as const

export type PosCustomization = (typeof posCustomizations)[number]['id']

const byId = new Map<string, (typeof posCustomizations)[number]>(posCustomizations.map((c) => [c.id, c]))

export function isPosCustomization(value: unknown): value is PosCustomization {
  return typeof value === 'string' && byId.has(value)
}

// Thứ tự chuẩn để cùng một bộ tùy chỉnh luôn cho cùng khóa dòng và cùng mô tả.
export function normalizeCustomizations(ids: readonly PosCustomization[]): PosCustomization[] {
  return posCustomizations.map((c) => c.id).filter((id) => ids.includes(id))
}

export function customizationSurcharge(ids: readonly PosCustomization[]): number {
  return ids.reduce((sum, id) => sum + (byId.get(id)?.price ?? 0), 0)
}

export function describeCustomizations(ids: readonly PosCustomization[]): string {
  return normalizeCustomizations(ids).map((id) => byId.get(id)!.label).join(' + ')
}
