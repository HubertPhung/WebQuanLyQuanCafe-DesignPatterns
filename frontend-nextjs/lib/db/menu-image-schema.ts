// Older Supabase bootstraps used varchar(255), which cannot hold uploaded data URLs.
// Match the Drizzle schema without changing existing images.
export const MENU_IMAGE_SCHEMA_SQL = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'admin_menu_items'::regclass
      AND attname = 'image_url' AND NOT attisdropped
      AND atttypid <> 'text'::regtype
  ) THEN
    PERFORM set_config('lock_timeout', '3s', true);
    ALTER TABLE admin_menu_items ALTER COLUMN image_url TYPE text;
  END IF;
END $$;
`
