export interface Location {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
  hierarchy_parent_id: string | null;
}
