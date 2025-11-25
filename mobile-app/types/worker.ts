export interface Worker {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  pin_code: string;
  auth_user_id: string | null;
  active: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
}
