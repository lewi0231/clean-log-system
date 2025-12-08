-- -*- mode: sql; sql-product: postgres -*-
-- Phase 4: Add descriptive comments to tables that lack them

COMMENT ON TABLE base_pricing IS 
  'Base pricing configuration for job types or standalone services. Supports both field-based (linked to field configs) and standalone pricing.';

COMMENT ON TABLE field_pricing IS 
  'Per-unit or fixed pricing rules for field configurations. Can be organization-wide or location-specific.';

COMMENT ON TABLE option_pricing IS 
  'Pricing configuration for select field options. Each option value can have different pricing per location.';

COMMENT ON TABLE job_worker IS 
  'Many-to-many relationship table linking jobs to assigned workers. A job can have multiple workers, and a worker can be assigned to multiple jobs.';

COMMENT ON TABLE worker IS 
  'Workers who complete jobs for organizations. Linked to auth.users via auth_user_id for authentication.';

COMMENT ON TABLE location IS 
  'Physical locations (customers/sites) where jobs are performed. Can belong to a location hierarchy node for pricing inheritance.';

COMMENT ON TABLE worker_invitation IS 
  'Pending invitations for workers to join organizations. Contains invitation token and expiration details.';

COMMENT ON TABLE pricing_rule IS 
  'Unified pricing table supporting field, option, and base pricing with location hierarchies and effective dating. Replaces legacy pricing_rules, base_pricing, field_pricing, and option_pricing tables.';

COMMENT ON TABLE pricing_condition IS 
  'Defines conditional logic for pricing rules. Allows complex pricing scenarios based on field values.';

COMMENT ON TABLE pricing_snapshot IS 
  'Immutable record of pricing rule data stored at invoice creation time. Ensures historical accuracy of invoice pricing.';

