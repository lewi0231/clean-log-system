-- -*- mode: sql; sql-product: postgres -*-
-- Create storage bucket for organization logos

-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-logos',
  'organization-logos',
  true,  -- Public so logos can be accessed via URL
  5242880,  -- 5MB limit (5 * 1024 * 1024)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Service role can manage all logo files
CREATE POLICY "Service role can manage organization logos"
ON storage.objects FOR ALL
USING (bucket_id = 'organization-logos' AND auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (bucket_id = 'organization-logos' AND auth.jwt() ->> 'role' = 'service_role');

-- Storage policy: Public read access for logos (so they can be displayed)
CREATE POLICY "Public can view organization logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'organization-logos');

