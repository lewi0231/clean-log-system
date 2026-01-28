-- -*- mode: sql; sql-product: postgres -*-
-- Add review_submitted notification type, RLS for dashboard, and Realtime for live updates

-- 1. Add 'review_submitted' to notification type check
ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check;
ALTER TABLE notification ADD CONSTRAINT notification_type_check CHECK (type IN (
  'worker_active',
  'job_completed',
  'invoice_generated',
  'payment_received',
  'review_submitted'
));

-- 2. Allow authenticated users to read and update their own notifications (receiver_id = their organization_user id)
CREATE POLICY "Authenticated users can read own notifications"
  ON notification
  FOR SELECT
  TO authenticated
  USING (
    receiver_id IN (
      SELECT id FROM organization_user WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update own notifications"
  ON notification
  FOR UPDATE
  TO authenticated
  USING (
    receiver_id IN (
      SELECT id FROM organization_user WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    receiver_id IN (
      SELECT id FROM organization_user WHERE auth_user_id = auth.uid()
    )
  );

-- 3. Enable Realtime for notification table (so dashboard bell updates on new inserts)
ALTER PUBLICATION supabase_realtime ADD TABLE notification;
