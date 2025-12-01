export interface FormSection {
  id: string;
  organization_id: string;
  title: string;
  description?: string | null;
  order_position: number;
  collapsed_by_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormSectionWithFields extends FormSection {
  field_ids: string[];
}
