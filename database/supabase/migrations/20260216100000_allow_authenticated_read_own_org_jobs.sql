-- Allow authenticated org users to SELECT jobs in their organization.
-- Required for Supabase Realtime: RLS policies must allow SELECT on changed rows,
-- or postgres_changes events are silently suppressed.
-- Without this, job realtime subscriptions receive no events for dashboard admins.

-- Drop existing policy if present for idempotency
DROP POLICY IF EXISTS "Authenticated users can read own org jobs" ON job;

CREATE POLICY "Authenticated users can read own org jobs"
  ON job FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_user
      WHERE auth_user_id = auth.uid()
    )
  );
