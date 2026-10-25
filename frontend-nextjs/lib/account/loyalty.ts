// Hạng thành viên theo cách Customer.updateRank bên Java gán: theo tổng chi tiêu trên các đơn đã
// thanh toán, không theo điểm. Mức giảm là tỷ lệ của CustomerRank, áp dụng khi thành viên thanh
// toán (LoyaltyTierDiscountStrategy).

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

/** Hạng tiếp theo và cần chi thêm bao nhiêu để đạt; null khi đã ở hạng cao nhất. */
export function nextRank(totalSpent: number) {
  const next = RANKS.find((entry) => entry.minSpent > totalSpent)
  return next ? { ...next, remaining: next.minSpent - totalSpent } : null
}
