-- Realtime + RLS for job_worker so mobile clients can subscribe to colleague confirmation updates.
-- Supabase Realtime requires SELECT permission on changed rows (same pattern as job).

-- Allow org dashboard users (organization_user) OR field workers (worker.auth_user_id) to read
-- job_worker rows for jobs in their organization.
DROP POLICY IF EXISTS "Authenticated users can read job_worker for own org jobs" ON job_worker;
DROP POLICY IF EXISTS "Workers can read job_worker for own org jobs" ON job_worker;

CREATE POLICY "Authenticated users can read job_worker for own org jobs"
  ON job_worker FOR SELECT
  TO authenticated
  USING (
    job_id IN (
      SELECT j.id
      FROM job j
      WHERE j.organization_id IN (
        SELECT organization_id
        FROM organization_user
        WHERE auth_user_id = auth.uid()
      )
    )
    OR
    job_id IN (
      SELECT j.id
      FROM job j
      INNER JOIN worker w ON w.organization_id = j.organization_id
      WHERE w.auth_user_id = auth.uid()
    )
  );

-- Publish job_worker for postgres_changes subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'job_worker'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE job_worker;
  END IF;
END $$;
