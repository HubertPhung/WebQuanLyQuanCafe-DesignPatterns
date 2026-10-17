import { Suspense } from 'react'
import { AuthFrame } from '@/components/auth/auth-frame'

// Shared by /login and /register: the brand panel and the mode switch stay mounted while the
// user moves between the two pages, so only the form card animates.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AuthFrame>{children}</AuthFrame>
    </Suspense>
  )
}
