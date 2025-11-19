export interface Worker {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  pin_code: string;
  active: boolean;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  email: string;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
}
