-- Enable realtime for job table to support real-time dashboard updates
-- when jobs are completed (e.g., worker submits from mobile app) or updated

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'job'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE job;
  END IF;
END $$;
