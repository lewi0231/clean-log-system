-- Migration: Add admin user management fields to organization_user table
-- This supports user stories 001-005 for admin user invitation, activation, and management

-- Add new columns to organization_user table
ALTER TABLE "public"."organization_user"
ADD COLUMN IF NOT EXISTS "first_name" TEXT,
ADD COLUMN IF NOT EXISTS "last_name" TEXT,
ADD COLUMN IF NOT EXISTS "phone" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'inactive')),
ADD COLUMN IF NOT EXISTS "auth_user_id" UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS "invited_at" TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMPTZ;

-- Add comment for the status column
COMMENT ON COLUMN "public"."organization_user"."status" IS 'User account status: pending (invited but not activated), active (can access dashboard), inactive (disabled)';

-- Add comment for auth_user_id
COMMENT ON COLUMN "public"."organization_user"."auth_user_id" IS 'Links to Supabase Auth user. NULL until user accepts invitation and creates password.';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_organization_user_auth_user_id" ON "public"."organization_user"("auth_user_id");
CREATE INDEX IF NOT EXISTS "idx_organization_user_status" ON "public"."organization_user"("status");
CREATE INDEX IF NOT EXISTS "idx_organization_user_org_status" ON "public"."organization_user"("organization_id", "status");

-- Update existing records to have 'active' status (they are already using the system)
-- We set status to 'active' for existing users since they were created before the invitation flow
UPDATE "public"."organization_user"
SET "status" = 'active',
    "activated_at" = "created_at"
WHERE "status" IS NULL;

-- Add unique constraint to prevent duplicate auth_user_id per organization
-- (a user can only have one organization_user record per organization)
ALTER TABLE "public"."organization_user"
ADD CONSTRAINT "organization_user_org_auth_user_unique" 
UNIQUE ("organization_id", "auth_user_id");
