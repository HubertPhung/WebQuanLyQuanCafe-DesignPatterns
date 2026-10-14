export const TAX_RATE = 0.08

export function formatCurrency(value: number) {
  const num = typeof value === 'number' ? value : Number(value) || 0
  const vndValue = num < 500 ? Math.round(num * 10000) : Math.round(num)
  return `${vndValue.toLocaleString('vi-VN')} đ`
}

export function formatTrend(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export function formatElapsed(from: Date | string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(from).getTime()) / 60000))
  if (minutes < 60) return `${minutes} phút`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}p`
}

export function formatTime(value: Date | string) {
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export const paymentLabels = {
  cash: 'Tiền mặt',
  qr: 'Chuyển khoản QR',
  card: 'Thẻ ngân hàng',
} as const

export const statusLabels = {
  pending: 'Chờ pha chế',
  brewing: 'Đang thực hiện',
  ready: 'Sẵn sàng phục vụ',
  completed: 'Đã hoàn thành',
} as const

export const tableStatusLabels = {
  available: 'Bàn trống',
  occupied: 'Có khách',
  reserved: 'Đã đặt trước',
  cleaning: 'Đang dọn bàn',
} as const
