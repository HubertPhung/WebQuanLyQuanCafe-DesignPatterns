'use server'

import { inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { assertAdminAccess } from '@/lib/admin/access'
import { getJavaBackendUrl, payJavaTables, type GroupPaymentInput, type GroupPaymentReceipt } from '@/lib/api-client'
import { db, isDbConfigured } from '@/lib/db'
import { adminOrders } from '@/lib/db/schema'
import { getMockOrdersByCode, settleMockTables } from '@/lib/db/mock-store'

export async function settleTables(input: GroupPaymentInput): Promise<{ ok: true; receipt: GroupPaymentReceipt } | { ok: false; error: string }> {
  try {
    await assertAdminAccess()
    const ids = input.tableIds
    if (!Array.isArray(ids) || ids.length < 2 || ids.length > 10 || new Set(ids).size !== ids.length || ids.some(id => !Number.isInteger(id) || id < 1)) throw new Error('Chọn từ 2 đến 10 bàn khác nhau.')
    if (!['cash', 'qr', 'card'].includes(input.paymentMethod)) throw new Error('Phương thức thanh toán không hợp lệ.')
    if (input.expectedTotal !== undefined && (!Number.isFinite(input.expectedTotal) || input.expectedTotal < 0)) throw new Error('Tổng tiền không hợp lệ.')
    let receipt: GroupPaymentReceipt
    if (!getJavaBackendUrl() && !isDbConfigured) {
      receipt = settleMockTables(ids, input.paymentMethod, input.tenderedAmount, input.expectedTotal)
    } else {
      const remote = await payJavaTables(input)
      if (!remote.ok) return { ok: false, error: remote.error }
      receipt = remote.data
      const codes = receipt.orders.map(order => order.orderCode)
      try {
        if (isDbConfigured && db) await db.update(adminOrders).set({ paymentStatus: 'paid', paymentMethod: input.paymentMethod }).where(inArray(adminOrders.orderCode, codes))
        else for (const order of getMockOrdersByCode(codes)) { order.paymentStatus = 'paid'; order.paymentMethod = input.paymentMethod }
      } catch {
        receipt.warnings = [...(receipt.warnings ?? []), 'Đã thanh toán tại Java nhưng chưa đồng bộ được bản sao giao diện.']
      }
    }
    revalidatePath('/admin', 'layout')
    return { ok: true, receipt }
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Không thể thanh toán gộp.' } }
}
