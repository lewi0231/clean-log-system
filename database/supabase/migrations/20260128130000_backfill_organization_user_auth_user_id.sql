-- -*- mode: sql; sql-product: postgres -*-
-- Backfill auth_user_id for organization_user rows where it's NULL but we can match by email.
-- This fixes RLS for notifications (which requires auth_user_id to be set).

UPDATE organization_user ou
SET auth_user_id = au.id
FROM auth.users au
WHERE ou.auth_user_id IS NULL
  AND LOWER(ou.email) = LOWER(au.email);

-- Also ensure status is 'active' for users that have auth_user_id set
UPDATE organization_user
SET status = 'active',
    activated_at = COALESCE(activated_at, NOW())
WHERE auth_user_id IS NOT NULL
  AND status = 'pending';
