// Membership ranks as Java's Customer.updateRank assigns them: by lifetime spend on paid orders,
// not by points. The discount is CustomerRank's rate, applied when a member pays (LoyaltyTierDiscountStrategy).

export type Rank = 'bronze' | 'silver' | 'gold' | 'vip'

export const RANKS: { rank: Rank; label: string; minSpent: number; discount: number }[] = [
  { rank: 'bronze', label: 'Thành viên Đồng', minSpent: 0, discount: 0 },
  { rank: 'silver', label: 'Thành viên Bạc', minSpent: 500_000, discount: 0.05 },
  { rank: 'gold', label: 'Thành viên Vàng', minSpent: 2_000_000, discount: 0.1 },
  { rank: 'vip', label: 'Thành viên Kim Cương', minSpent: 5_000_000, discount: 0.15 },
]

export function rankInfo(rank: Rank) {
  return RANKS.find((entry) => entry.rank === rank) ?? RANKS[0]
}

/** The next rank and how much more spending reaches it; null at the top. */
export function nextRank(totalSpent: number) {
  const next = RANKS.find((entry) => entry.minSpent > totalSpent)
  return next ? { ...next, remaining: next.minSpent - totalSpent } : null
}
