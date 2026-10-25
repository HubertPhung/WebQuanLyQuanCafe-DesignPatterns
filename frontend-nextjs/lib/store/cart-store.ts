'use client'

import { create } from 'zustand'
import type { Cart, Money } from '@/lib/shopify'
import { toast } from 'sonner'

export const formatMoneyVND = (m?: Money | { amount: string; currencyCode?: string } | number | string) => {
  if (m === undefined || m === null) return '0 đ'
  let num: number
  if (typeof m === 'number') num = m
  else if (typeof m === 'string') num = Number(m)
  else num = Number(m.amount)

  if (isNaN(num)) return '0 đ'
  const val = num < 500 ? Math.round(num * 10000) : Math.round(num)
  return `${val.toLocaleString('vi-VN')} đ`
}

// Đặt món cần tài khoản; khách quay lại thực đơn sau khi đăng nhập.
export function redirectToSignIn() {
  toast.info('Vui lòng đăng nhập để đặt món.')
  const back = `${window.location.pathname}${window.location.search}#menu`
  window.location.assign(`/login?next=${encodeURIComponent(back)}`)
}

export interface CartStoreState {
  cart: Cart | null
  isOpen: boolean
  isBusy: boolean

  // Các hành động
  setIsOpen: (isOpen: boolean) => void
  openCart: () => void
  closeCart: () => void
  setCart: (cart: Cart | null) => void
  fetchCart: () => Promise<Cart | null>
  addToCart: (
    product: { title: string },
    variantId: string,
    options?: Record<string, string>
  ) => Promise<boolean>
  updateQuantity: (lineId: string, quantity: number) => Promise<boolean>
  removeItem: (lineId: string) => Promise<boolean>
  applyPromo: (code: string) => Promise<{ success: boolean; message: string }>
  updateNote: (note: string) => Promise<boolean>
}

export const useCartStore = create<CartStoreState>((set, get) => ({
  cart: null,
  isOpen: false,
  isBusy: false,

  setIsOpen: (isOpen: boolean) => set({ isOpen }),
  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),
  setCart: (cart: Cart | null) => set({ cart }),

  fetchCart: async () => {
    try {
      const res = await fetch('/api/cart')
      if (!res.ok) return null
      const data: Cart = await res.json()
      set({ cart: data })
      return data
    } catch {
      return null
    }
  },

  addToCart: async (product, variantId, options = {}) => {
    set({ isBusy: true })
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          variantId,
          options,
        }),
      })
      const data = await res.json()
      if (res.status === 401 && data.loginRequired) {
        redirectToSignIn()
        return false
      }
      if (!res.ok) throw new Error(data.error || 'Không thể thêm món vào giỏ hàng')
      set({ cart: data, isOpen: true })
      toast.success(`Đã thêm "${product.title}" vào túi cà phê!`)
      return true
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi thêm vào giỏ')
      return false
    } finally {
      set({ isBusy: false })
    }
  },

  updateQuantity: async (lineId, quantity) => {
    set({ isBusy: true })
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'quantity',
          lineId,
          quantity,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Không thể cập nhật số lượng')
      set({ cart: data })
      return true
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi cập nhật số lượng')
      return false
    } finally {
      set({ isBusy: false })
    }
  },

  removeItem: async (lineId) => {
    return get().updateQuantity(lineId, 0)
  },

  applyPromo: async (code) => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      return { success: false, message: 'Vui lòng nhập mã ưu đãi' }
    }
    set({ isBusy: true })
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'discount',
          code: trimmed,
        }),
      })
      const data: Cart = await res.json()
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error || 'Mã không hợp lệ')
      set({ cart: data })

      const isApplied = data.discountCodes?.some((d) => d.applicable)
      if (isApplied) {
        toast.success(`Đã áp dụng mã ưu đãi ${trimmed} (-10%)!`)
        return { success: true, message: `Mã ${trimmed} đã được áp dụng (-10%)` }
      } else {
        toast.error('Mã không hợp lệ hoặc đã hết hạn.')
        return { success: false, message: 'Mã không hợp lệ hoặc đã hết hạn (Gợi ý: WELCOME10)' }
      }
    } catch (err) {
      toast.error((err as Error).message)
      return { success: false, message: (err as Error).message }
    } finally {
      set({ isBusy: false })
    }
  },

  updateNote: async (note) => {
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'note',
          note,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      set({ cart: data })
      toast.success('Đã lưu ghi chú cho barista!')
      return true
    } catch (err) {
      toast.error((err as Error).message || 'Không thể lưu ghi chú')
      return false
    }
  },
}))

