import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { loadActiveVouchers } from '@/lib/storefront/active-vouchers'

/** Danh sách voucher đang chạy mà tài khoản hiện tại có thể sử dụng khi đặt hàng online. */
export async function GET() {
  const session = await getSession()
  const vouchers = await loadActiveVouchers(session?.userId)
  return NextResponse.json({ vouchers })
}
