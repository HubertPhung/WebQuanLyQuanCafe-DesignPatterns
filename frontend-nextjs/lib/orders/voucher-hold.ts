// Đơn COD giữ lượt voucher bên Java trước khi được ghi cục bộ. Ghi đơn không thành (trả lỗi hay ném
// lỗi) thì lượt phải được trả, nếu không khách mất lượt cho một đơn không tồn tại (WELCOME10 chỉ
// có một lượt mỗi tài khoản).

type ReleaseResult = { ok: true; data: { released: boolean } } | { ok: false; error: string }

export async function withVoucherHold<T extends { ok: boolean }>(
  held: boolean,
  work: () => Promise<T>,
  release: () => Promise<ReleaseResult>,
  reportReleaseFailure: (message: string) => void,
): Promise<T> {
  const giveBack = async () => {
    try {
      const result = await release()
      if (!result.ok) reportReleaseFailure(`Không trả được lượt voucher: ${result.error}`)
    } catch (error) {
      reportReleaseFailure(`Không trả được lượt voucher: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  let result: T
  try {
    result = await work()
  } catch (error) {
    if (held) await giveBack()
    throw error
  }
  if (!result.ok && held) await giveBack()
  return result
}
