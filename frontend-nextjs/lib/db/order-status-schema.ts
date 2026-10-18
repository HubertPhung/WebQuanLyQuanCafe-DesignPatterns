// Upgrade the CHECK constraint installed by the original database bootstrap.
// Keep this atomic: other connections must never see an unconstrained status column.
export const ORDER_CANCELLATION_SCHEMA_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'admin_orders'::regclass
      AND conname = 'admin_orders_status_check'
      AND position('cancelled' in pg_get_constraintdef(oid)) > 0
  ) THEN
    PERFORM set_config('lock_timeout', '3s', true);
    ALTER TABLE admin_orders DROP CONSTRAINT IF EXISTS admin_orders_status_check;
    ALTER TABLE admin_orders ADD CONSTRAINT admin_orders_status_check
      CHECK (status IN ('pending', 'brewing', 'ready', 'completed', 'cancelled'));
  END IF;
END $$;
`
