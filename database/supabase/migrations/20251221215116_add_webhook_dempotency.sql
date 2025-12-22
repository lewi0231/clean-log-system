-- -*- mode: sql; sql-product: postgres -*-
-- Add webhook idempotency protection
-- Tracks processed webhook events to prevent duplicate processing

CREATE TABLE IF NOT EXISTS webhook_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE, -- Stripe event ID (e.g., "evt_1234567890")
  event_type TEXT NOT NULL, -- Stripe event type (e.g., "checkout.session.completed")
  processed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status TEXT DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'retrying')),
  error_message TEXT,
  metadata JSONB, -- Store event metadata for debugging
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE webhook_event IS 'Tracks processed webhook events for idempotency protection';
COMMENT ON COLUMN webhook_event.event_id IS 'Unique identifier from webhook provider (e.g., Stripe event ID)';
COMMENT ON COLUMN webhook_event.event_type IS 'Type of webhook event (e.g., checkout.session.completed)';
COMMENT ON COLUMN webhook_event.status IS 'Processing status: processed, failed, or retrying';
COMMENT ON COLUMN webhook_event.metadata IS 'Additional event metadata for debugging';

-- Index for quick lookups by event_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_event_id ON webhook_event(event_id);

-- Index for querying by event type
CREATE INDEX IF NOT EXISTS idx_webhook_event_type ON webhook_event(event_type);

-- Index for querying by status
CREATE INDEX IF NOT EXISTS idx_webhook_event_status ON webhook_event(status);

-- Index for querying by processed_at (for cleanup of old events)
CREATE INDEX IF NOT EXISTS idx_webhook_event_processed_at ON webhook_event(processed_at DESC);

