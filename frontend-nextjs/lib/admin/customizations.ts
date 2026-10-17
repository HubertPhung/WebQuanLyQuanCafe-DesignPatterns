// POS line customizations. Ids and surcharges mirror the Java Decorators
// (LargeSizeDecorator, CheeseFoamDecorator, PearlToppingDecorator) so the price shown at the
// counter matches the price the backend computes for POST /api/checkout.

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

// Canonical order so the same set always yields the same line key and description.
export function normalizeCustomizations(ids: readonly PosCustomization[]): PosCustomization[] {
  return posCustomizations.map((c) => c.id).filter((id) => ids.includes(id))
}

export function customizationSurcharge(ids: readonly PosCustomization[]): number {
  return ids.reduce((sum, id) => sum + (byId.get(id)?.price ?? 0), 0)
}

export function describeCustomizations(ids: readonly PosCustomization[]): string {
  return normalizeCustomizations(ids).map((id) => byId.get(id)!.label).join(' + ')
}
