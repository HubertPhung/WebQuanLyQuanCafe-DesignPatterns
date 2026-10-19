'use server'

import { revalidatePath } from 'next/cache'
import { assertAdminAccess } from '@/lib/admin/access'
import { saveJavaTable, deleteJavaTable, getJavaBackendUrl } from '@/lib/api-client'
import { saveMockTable, deleteMockTable } from '@/lib/db/mock-store'
import { isDbConfigured } from '@/lib/db'
import { saveDatabaseTable, deleteDatabaseTable, mirrorDatabaseTable, mirrorDeletedTable } from '@/lib/admin/table-repository'
import { getAdminBranch } from '@/lib/admin/branch'
import type { FloorTable } from '@/lib/db/schema'
import { localImageSrc } from '@/lib/assets'

export type TableDetails = { name: string; seats: number; zone: string; imageUrl: string | null }
type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export async function saveTableDetails(input: TableDetails, id?: number): Promise<Result<FloorTable>> {
  try {
    await assertAdminAccess('MANAGER')
    const details = { name: String(input.name ?? '').trim(), zone: String(input.zone ?? '').trim(), seats: Number(input.seats), imageUrl: String(input.imageUrl ?? '').trim() || null }
    if (!details.name || details.name.length > 100 || !details.zone || details.zone.length > 50 || !Number.isInteger(details.seats) || details.seats < 1 || details.seats > 100) throw new Error('Nhập tên bàn, khu vực và số chỗ từ 1 đến 100.')
    if (id !== undefined && (!Number.isInteger(id) || id <= 0)) throw new Error('Mã bàn không hợp lệ.')
    if (details.imageUrl) {
      const localImage = localImageSrc(details.imageUrl, '')
      if (!localImage.startsWith('/') || localImage.length > 2048) throw new Error('Vui lòng tải ảnh lên hoặc dùng đường dẫn ảnh trong trang.')
      details.imageUrl = localImage
    }
    // A new table joins the branch chosen in the header; an edited one keeps its branch.
    const located = { ...details, branch: await getAdminBranch() }
    let table: FloorTable
    if (getJavaBackendUrl()) {
      const result = await saveJavaTable(located, id)
      if (result.ok) {
        table = { ...result.data, occupiedSince: result.data.occupiedSince ? new Date(result.data.occupiedSince) : null, updatedAt: new Date() }
        if (isDbConfigured) await mirrorDatabaseTable(table)
      }
      else if (!result.unreachable) throw new Error(result.error)
      else table = isDbConfigured ? await saveDatabaseTable(located, id) : saveMockTable(located, id)
    } else {
      table = isDbConfigured ? await saveDatabaseTable(located, id) : saveMockTable(located, id)
    }
    revalidatePath('/admin', 'layout')
    return { ok: true, data: table }
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Không thể lưu bàn.' } }
}

export async function deleteTable(id: number): Promise<Result<null>> {
  try {
    await assertAdminAccess('MANAGER')
    if (!Number.isInteger(id) || id <= 0) throw new Error('Mã bàn không hợp lệ.')
    if (getJavaBackendUrl()) {
      const result = await deleteJavaTable(id)
      if (result.ok) {
        if (isDbConfigured) await mirrorDeletedTable(id)
      } else {
        if (!result.unreachable) throw new Error(result.error)
        if (isDbConfigured) await deleteDatabaseTable(id)
        else deleteMockTable(id)
      }
    } else {
      if (isDbConfigured) await deleteDatabaseTable(id)
      else deleteMockTable(id)
    }
    revalidatePath('/admin', 'layout')
    return { ok: true, data: null }
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Không thể xóa bàn.' } }
}
