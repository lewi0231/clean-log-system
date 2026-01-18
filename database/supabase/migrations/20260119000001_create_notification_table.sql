-- -*- mode: sql; sql-product: postgres -*-
-- Notification Table
-- Supports in-app notifications for admins (worker activation, job completion, etc.)

-- Notification Table
CREATE TABLE notification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES organization_user(id) ON DELETE CASCADE,
  
  -- Notification Content
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Related Entity (for navigation/context)
  related_entity_type TEXT, -- e.g., 'worker', 'job', 'invoice'
  related_entity_id UUID,
  
  -- Read State
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Type validation
  CONSTRAINT notification_type_check CHECK (type IN (
    'worker_active',
    'job_completed',
    'invoice_generated',
    'payment_received'
  ))
);

COMMENT ON TABLE notification IS 'In-app notifications for organization admins';
COMMENT ON COLUMN notification.type IS 'Type of notification event';
COMMENT ON COLUMN notification.receiver_id IS 'Specific recipient (null = all admins in org)';
COMMENT ON COLUMN notification.related_entity_type IS 'Type of entity this notification relates to';
COMMENT ON COLUMN notification.related_entity_id IS 'ID of related entity for navigation';

-- Indexes for efficient queries
CREATE INDEX idx_notification_org_receiver ON notification(organization_id, receiver_id, read, created_at DESC);
CREATE INDEX idx_notification_unread ON notification(organization_id, receiver_id) WHERE read = FALSE;
CREATE INDEX idx_notification_related_entity ON notification(related_entity_type, related_entity_id);

-- Row Level Security
ALTER TABLE notification ENABLE ROW LEVEL SECURITY;

-- RLS Policy - follows existing service_role pattern used throughout the codebase
CREATE POLICY "Service role can manage notification"
  ON notification
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
