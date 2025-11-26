// Shared types for Supabase Edge Functions

export interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface JobWorker {
  job_id: string;
  worker: Worker | null;
}

// Type for raw Supabase query result (worker may be inferred as array)
export interface JobWorkerQueryResult {
  job_id: string;
  worker: Worker | Worker[] | null;
}

export interface Location {
  id: string;
  name: string;
  email: string;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
}

export interface Job {
  id: string;
  organization_id: string;
  location_id: string | null;
  submission_data: Record<string, unknown> | null;
  completed_at: string;
  created_at: string;
  location: Location | null;
  workers: Worker[];
}
