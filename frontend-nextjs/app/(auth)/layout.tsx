import { Suspense } from 'react'
import { AuthFrame } from '@/components/auth/auth-frame'

// Dùng chung cho /login và /register: khung thương hiệu và nút chuyển chế độ giữ nguyên khi người
// dùng chuyển giữa hai trang, chỉ thẻ form có hiệu ứng.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AuthFrame>{children}</AuthFrame>
    </Suspense>
  )
}
