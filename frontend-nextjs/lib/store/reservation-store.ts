'use client'

import { create } from 'zustand'

export interface PreOrderItem {
  id: number
  title: string
  quantity: number
  price: number
}

interface ReservationStoreState {
  isOpen: boolean
  preOrders: PreOrderItem[]
  openReservation: (preOrders?: PreOrderItem[]) => void
  closeReservation: () => void
}

export const useReservationStore = create<ReservationStoreState>((set) => ({
  isOpen: false,
  preOrders: [],
  openReservation: (preOrders = []) => set({ isOpen: true, preOrders }),
  closeReservation: () => set({ isOpen: false, preOrders: [] }),
}))
