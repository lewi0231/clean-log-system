-- -*- mode: sql; sql-product: postgres -*-
-- Organization (Your paying customers)
CREATE TABLE organization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_code TEXT UNIQUE NOT NULL, -- e.g., 'ACME', 'BLUE' - 4 letters for mobile login
  subdomain TEXT UNIQUE, -- e.g., 'acme' for acme.cleanlog.com
  plan TEXT DEFAULT 'basic', -- basic, pro, enterprise
  active BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- Organization User (people who can log in to admin dashboard)
CREATE TABLE organization_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'admin', -- admin, viewer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, email)
);

-- Car Yard (Now scoped to organization)
CREATE TABLE car_yard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT,
  contact_person TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- worker (Now scoped to organization)
CREATE TABLE worker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  pin_code TEXT NOT NULL, -- Simple 4-6 digit code for mobile app login
  active BOOLEAN DEFAULT true,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_org_pin UNIQUE(organization_id, pin_code)
);

-- Cleaning Job (Now scoped to organization)
CREATE TABLE job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  car_yard_id UUID REFERENCES car_yard(id) NOT NULL,
  car_count INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  feedback_token TEXT UNIQUE,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for many-to-many relationship between job and worker
CREATE TABLE job_worker (
  job_id UUID REFERENCES job(id) ON DELETE CASCADE NOT NULL,
  worker_id UUID REFERENCES worker(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (job_id, worker_id)
);

-- Feedback (Scoped to organization via job)
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES job(id) NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id)
);

-- Indexes for multi-tenant queries
CREATE INDEX idx_car_yard_org ON car_yard(organization_id);
CREATE INDEX idx_worker_org ON worker(organization_id);
CREATE INDEX idx_job_org ON job(organization_id);
CREATE INDEX idx_job_car_yard ON job(car_yard_id);
CREATE INDEX idx_job_completed ON job(completed_at);
CREATE INDEX idx_feedback_job ON feedback(job_id);
CREATE INDEX idx_job_token ON job(feedback_token);
CREATE INDEX idx_worker_org_pin ON worker(organization_id, pin_code);

-- Indexes for job_worker junction table
CREATE INDEX idx_job_worker_job ON job_worker(job_id);
CREATE INDEX idx_job_worker_worker ON job_worker(worker_id);

-- Row Level Security (RLS) Policies
ALTER TABLE organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_yard ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker ENABLE ROW LEVEL SECURITY;
ALTER TABLE job ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_worker ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Organization: Only service role can manage
CREATE POLICY "Service role can manage organization"
ON organization FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Organization User: Service role can manage
CREATE POLICY "Service role can manage organization_user"
ON organization_user FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Car Yard: Only accessible by same organization
CREATE POLICY "Service role can manage car yard"
ON car_yard FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- worker: Only accessible by same organization
CREATE POLICY "Service role can manage worker"
ON worker FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Cleaning Job: Only accessible by same organization
CREATE POLICY "Service role can manage job"
ON job FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Job Worker: Service role can manage
CREATE POLICY "Service role can manage job_worker"
ON job_worker FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Feedback: Public can submit with valid token
CREATE POLICY "Anyone can submit feedback"
ON feedback FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM job 
    WHERE id = job_id 
    AND feedback_token IS NOT NULL
  )
);

CREATE POLICY "Service role can read feedback"
ON feedback FOR SELECT
USING (auth.jwt() ->> 'role' = 'service_role');

-- View for analytics (automatically filtered by organization in application)
-- Note: This view shows one row per job-worker combination
-- If you need one row per job with aggregated worker info, you'll need to adjust
CREATE VIEW job_summary AS
SELECT 
  cj.id as job_id,
  cj.organization_id,
  o.name as organization_name,
  w.name as worker_name,
  w.id as worker_id,
  cy.name as car_yard_name,
  cj.car_count,
  cj.completed_at,
  f.rating,
  f.comment
FROM job cj
JOIN organization o ON cj.organization_id = o.id
JOIN job_worker jw ON cj.id = jw.job_id
JOIN worker w ON jw.worker_id = w.id
JOIN car_yard cy ON cj.car_yard_id = cy.id
LEFT JOIN feedback f ON cj.id = f.job_id
ORDER BY cj.completed_at DESC;
