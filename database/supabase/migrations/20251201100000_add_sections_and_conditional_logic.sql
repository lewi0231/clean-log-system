-- Migration: Add sections and conditional logic support to field configurations
-- This enables:
-- 1. Grouping fields into collapsible sections
-- 2. Conditional visibility based on other field values

-- Create form_section table to store section metadata
CREATE TABLE IF NOT EXISTS public.form_section (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_position INTEGER NOT NULL DEFAULT 0,
    collapsed_by_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add section_id column to organization_field_configs to link fields to sections
ALTER TABLE public.organization_field_configs 
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.form_section(id) ON DELETE SET NULL;

-- Add conditional_logic column to organization_field_configs for show/hide rules
-- Structure: { conditions: [{ field_id, operator, value }], match_type: 'all' | 'any' }
ALTER TABLE public.organization_field_configs 
ADD COLUMN IF NOT EXISTS conditional_logic JSONB;

-- Create index for faster section lookups
CREATE INDEX IF NOT EXISTS idx_organization_field_configs_section_id ON public.organization_field_configs(section_id);

-- Create index for organization lookups on form_section
CREATE INDEX IF NOT EXISTS idx_form_section_organization_id ON public.form_section(organization_id);

-- Enable RLS on form_section
ALTER TABLE public.form_section ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view sections for their organization
CREATE POLICY "Users can view their organization's sections"
    ON public.form_section
    FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM public.worker 
            WHERE auth_user_id = auth.uid()
        )
    );

-- RLS Policy: Users can insert sections for their organization
CREATE POLICY "Users can create sections for their organization"
    ON public.form_section
    FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.worker 
            WHERE auth_user_id = auth.uid()
        )
    );

-- RLS Policy: Users can update sections for their organization
CREATE POLICY "Users can update their organization's sections"
    ON public.form_section
    FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM public.worker 
            WHERE auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.worker 
            WHERE auth_user_id = auth.uid()
        )
    );

-- RLS Policy: Users can delete sections for their organization
CREATE POLICY "Users can delete their organization's sections"
    ON public.form_section
    FOR DELETE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM public.worker 
            WHERE auth_user_id = auth.uid()
        )
    );

-- Add comment explaining the conditional_logic structure
COMMENT ON COLUMN public.organization_field_configs.conditional_logic IS 
'JSON structure for conditional visibility:
{
  "conditions": [
    {
      "field_id": "uuid",
      "operator": "equals|not_equals|is_empty|is_not_empty|contains|greater_than|less_than",
      "value": "any value or null"
    }
  ],
  "match_type": "all|any"
}
When match_type is "all", field is shown when ALL conditions are true.
When match_type is "any", field is shown when ANY condition is true.';

-- Add comment for section_id
COMMENT ON COLUMN public.organization_field_configs.section_id IS 
'References a form_section to group this field. NULL means the field is unsectioned.';
