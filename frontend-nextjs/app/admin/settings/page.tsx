import { PageHeading } from '@/components/admin/shared'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TAX_RATE } from '@/lib/admin/format'

export const metadata = { title: 'Cài đặt' }

const rows = [
  { label: 'Chi nhánh vận hành', value: 'Chi nhánh 1 · Trung tâm' },
  { label: 'Đơn vị tiền tệ', value: 'Việt Nam Đồng (VNĐ)' },
  {
    label: (
      <>
        Thuế GTGT (VAT) <span className="sr-only">Sales tax</span>
      </>
    ),
    value: `${TAX_RATE * 100}%`,
  },
  {
    label: (
      <>
        Phương thức chấp nhận <span className="sr-only">Accepted payments</span>
      </>
    ),
    value: 'Tiền mặt, Chuyển khoản VietQR, Thẻ POS',
  },
  { label: 'Cửa hàng trực tuyến', value: 'Đà Lạt Cafe Storefront (Đang kích hoạt)' },
]

export default function SettingsPage() {
  return (
    <>
      <PageHeading title="Cài đặt hệ thống" description="Cấu hình hoạt động chi nhánh áp dụng cho bán lẻ POS và báo cáo kế toán." />
      <Card className="max-w-2xl rounded-xl border-stone-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-stone-900">
            Cấu hình chi nhánh <span className="sr-only">Branch configuration</span>
          </CardTitle>
          <CardDescription className="text-stone-600">Các thông số này được áp dụng tự động cho mọi đơn hàng mới.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col">
            {rows.map((row, index) => (
              <div key={index}>
                {index > 0 && <Separator className="bg-stone-100" />}
                <div className="flex items-center justify-between gap-4 py-3.5 text-sm">
                  <dt className="text-stone-600 font-medium">{row.label}</dt>
                  <dd className="font-bold text-stone-900">{row.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </>
  )
}
