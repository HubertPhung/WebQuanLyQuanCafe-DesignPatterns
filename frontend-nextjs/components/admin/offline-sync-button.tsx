'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CloudUpload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { syncOfflineOrders } from '@/app/admin/actions'

// Sends orders recorded while the Java backend was down (POST /api/orders/sync).
export function OfflineSyncButton({ pending }: { pending: number }) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()

  function sync() {
    startTransition(async () => {
      const result = await syncOfflineOrders()
      if (result.ok) toast.success(result.message ?? 'Đã đồng bộ.')
      else toast.error(result.error)
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={sync}
      disabled={busy || pending === 0}
      title={pending === 0 ? 'Máy chủ Java đã có mọi đơn' : 'Gửi các đơn ghi lúc mất kết nối sang máy chủ Java'}
      className="gap-2"
    >
      <CloudUpload className="size-4" />
      {busy ? 'Đang đồng bộ...' : `Đồng bộ đơn chưa gửi (${pending})`}
    </Button>
  )
}
