import { VoucherManagement } from '@/components/admin/voucher-management'
import { PageHeading } from '@/components/admin/shared'
import { fetchVouchers } from '@/lib/api-client'
import { requirePageRole } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quản lý Voucher · Coffee Shop Admin' }

export default async function AdminVouchersPage() {
  await requirePageRole('MANAGER', '/admin/vouchers')
  const result = await fetchVouchers()
  return (
    <div className="space-y-6">
      <PageHeading
        title="Quản lý Voucher"
        description="Tạo mã giảm giá theo dịp sale: mức giảm, đơn tối thiểu, số lượt dùng, ngày bắt đầu và ngày hết hạn."
      />
      <VoucherManagement vouchers={result.ok ? result.data : []} unavailable={!result.ok} />
    </div>
  )
}
