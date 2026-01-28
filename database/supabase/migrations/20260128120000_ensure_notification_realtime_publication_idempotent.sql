-- -*- mode: sql; sql-product: postgres -*-
-- Ensure notification table is in supabase_realtime publication (idempotent).
-- Safe to run after 20260128100000: no-op if table already in publication.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notification'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notification;
  END IF;
END $$;
