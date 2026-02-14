-- Enable realtime for worker table to support real-time dashboard updates
-- when worker status changes (e.g., accepting invitation → active)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'worker'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE worker;
  END IF;
END $$;
