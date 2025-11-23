-- Temporary invitations table
CREATE TABLE worker_invitation (
  id TEXT PRIMARY KEY, -- UUID token
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  worker_id UUID REFERENCES worker(id) ON DELETE CASCADE NOT NULL,
  worker_email TEXT NOT NULL,
  
  -- Track status
  accepted_at TIMESTAMPTZ,
  auth_user_id UUID, -- Links to auth.users after acceptance
  
  -- Security
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, worker_id)
);


-- Updated worker table
ALTER TABLE worker ADD COLUMN auth_user_id UUID UNIQUE;
-- This links worker to auth.users after they accept invitation

-- RLS Policies for worker table
-- Workers can only see their own record
CREATE POLICY "Workers can view own record"
ON worker FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

-- Service role (Edge Functions) can do anything
CREATE POLICY "Service role full access"
ON worker FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS for invitations
ALTER TABLE worker_invitation ENABLE ROW LEVEL SECURITY;

-- Anyone can view invitation (needed for invite link)
CREATE POLICY "Anyone can view invitations"
ON worker_invitation FOR SELECT
USING (true);

-- Only service role can insert/update
CREATE POLICY "Service role manages invitations"
ON worker_invitation FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role updates invitations"
ON worker_invitation FOR UPDATE
TO service_role
USING (true);

-- Index for queries
CREATE INDEX idx_invitations_token ON worker_invitation(id);
CREATE INDEX idx_invitations_org_worker ON worker_invitation(organization_id, worker_id);
CREATE INDEX idx_invitations_expires ON worker_invitation(expires_at);