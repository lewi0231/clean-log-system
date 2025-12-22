-- -*- mode: sql; sql-product: postgres -*-
-- Add rate limiting table for distributed rate limiting
-- Optional: Only needed if using database-backed rate limiting across multiple instances

CREATE TABLE IF NOT EXISTS rate_limit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP address or custom identifier
  window_start TIMESTAMPTZ NOT NULL, -- Start of the rate limit window
  request_count INTEGER DEFAULT 1 NOT NULL CHECK (request_count >= 0),
  last_request_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE rate_limit IS 'Tracks rate limit windows for distributed rate limiting';
COMMENT ON COLUMN rate_limit.identifier IS 'Client identifier (IP address or custom identifier)';
COMMENT ON COLUMN rate_limit.window_start IS 'Start timestamp of the rate limit window';
COMMENT ON COLUMN rate_limit.request_count IS 'Number of requests in the current window';

-- Index for quick lookups by identifier and window
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_window 
ON rate_limit(identifier, window_start DESC);

-- Index for cleanup of old entries
CREATE INDEX IF NOT EXISTS idx_rate_limit_window_start 
ON rate_limit(window_start);

-- Add TTL/cleanup: Old entries are automatically cleaned up by the rate limiter
-- For production, consider adding a scheduled job to clean up old entries

