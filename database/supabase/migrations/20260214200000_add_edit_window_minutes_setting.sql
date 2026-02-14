-- Add edit_window_minutes column to organization_settings
-- This allows organizations to configure how long workers have to withdraw submitted jobs

ALTER TABLE "public"."organization_settings"
ADD COLUMN IF NOT EXISTS "edit_window_minutes" integer DEFAULT 180;

-- Add constraint to ensure reasonable values (minimum 15 minutes, maximum 24 hours)
ALTER TABLE "public"."organization_settings"
ADD CONSTRAINT "check_edit_window_minutes" 
CHECK (("edit_window_minutes" >= 15) AND ("edit_window_minutes" <= 1440));

COMMENT ON COLUMN "public"."organization_settings"."edit_window_minutes" IS 'Number of minutes after job submission during which the submitter can withdraw the job. Default is 180 minutes (3 hours). Minimum 15 minutes, maximum 1440 minutes (24 hours).';
