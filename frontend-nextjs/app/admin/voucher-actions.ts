'use server'

import { revalidatePath } from 'next/cache'
import { assertAdminAccess } from '@/lib/admin/access'
import {
  createVoucher,
  deleteVoucher,
  fetchVoucherUsages,
  updateVoucher,
  type JavaResult,
  type VoucherInput,
  type VoucherUsageRow,
} from '@/lib/api-client'

type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

const UNREACHABLE = 'Chưa kết nối được backend Java. Voucher chỉ lưu bên Java, vui lòng thử lại sau.'

function failure(result: Extract<JavaResult<unknown>, { ok: false }>): ActionResult {
  return { ok: false, error: result.unreachable ? UNREACHABLE : result.error }
}

// Java kiểm tra lại mọi trường (mã, phần trăm, ngày, giới hạn); ở đây chỉ chuẩn hóa dữ liệu form.
function clean(input: VoucherInput): VoucherInput {
  const optional = (value: number | null) => (value === null || Number.isNaN(value) ? null : value)
  return {
    ...input,
    code: String(input.code ?? '').trim().toUpperCase(),
    description: String(input.description ?? '').trim().slice(0, 200) || null,
    maxDiscount: input.type === 'PERCENT' ? optional(input.maxDiscount) : null,
    maxUses: optional(input.maxUses),
    perAccountLimit: optional(input.perAccountLimit),
    minOrder: Number.isFinite(input.minOrder) ? input.minOrder : 0,
  }
}

export async function saveVoucher(id: number | null, input: VoucherInput): Promise<ActionResult> {
  try {
    await assertAdminAccess('MANAGER')
    const result = id === null ? await createVoucher(clean(input)) : await updateVoucher(id, clean(input))
    if (!result.ok) return failure(result)
    revalidatePath('/admin/vouchers')
    return { ok: true, message: id === null ? `Đã tạo voucher ${result.data.code}.` : `Đã lưu voucher ${result.data.code}.` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Không lưu được voucher.' }
  }
}

export async function removeVoucher(id: number): Promise<ActionResult> {
  try {
    await assertAdminAccess('MANAGER')
    const result = await deleteVoucher(id)
    if (!result.ok) return failure(result)
    revalidatePath('/admin/vouchers')
    return { ok: true, message: result.data.deleted ? 'Đã xóa voucher.' : 'Mã đã có người dùng nên đã được tắt thay vì xóa.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Không xóa được voucher.' }
  }
}

export async function loadVoucherUsages(id: number): Promise<{ ok: true; data: VoucherUsageRow[] } | { ok: false; error: string }> {
  try {
    await assertAdminAccess('MANAGER')
    const result = await fetchVoucherUsages(id)
    if (!result.ok) return { ok: false, error: result.unreachable ? UNREACHABLE : result.error }
    return { ok: true, data: result.data }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Không tải được lịch sử dùng mã.' }
  }
}
