-- -*- mode: sql; sql-product: postgres -*-
-- Allow authenticated users to read their own organization_user record
-- This is required for RLS policies on other tables (like notification) that 
-- use subqueries against organization_user to check ownership.

-- Add SELECT policy for authenticated users to read their own organization_user record
CREATE POLICY "Authenticated users can read own organization_user"
  ON organization_user
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());
