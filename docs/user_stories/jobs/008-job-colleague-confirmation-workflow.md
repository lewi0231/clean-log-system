# User Story 008: Job Colleague Confirmation Workflow

## Overview

When a worker submits a job that includes colleagues (other workers), those colleagues should have the opportunity to confirm their participation before the job is finalized. This ensures accountability, prevents fraud, and enables fair payment distribution based on verified participation.

## User Story

**As a** worker added as a colleague to a job  
**I want to** receive a notification and have the option to confirm or flag the job  
**So that** I can verify my participation was recorded accurately before payments are calculated

**As an** admin user  
**I want to** see and resolve flagged jobs  
**So that** I can address disputes and ensure accurate job records

**As the** submitting worker  
**I want to** be able to withdraw my submission within a short window  
**So that** I can correct mistakes before the job is finalized

## Key Concepts

### Confirmation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           JOB SUBMISSION FLOW                           │
└─────────────────────────────────────────────────────────────────────────┘

  Worker A submits job
  (adds Worker B, C as colleagues)
        │
        ▼
  ┌─────────────────────────┐
  │ Job Created             │
  │ approval_status: pending│◄──── Worker A auto-confirmed (submitter)
  │                         │      Worker B, C: pending_confirmation
  │ auto_approve_at: +24h   │
  │ edit_window_expires: +3h│
  └───────────┬─────────────┘
              │
              ├────────────────────────────────────────────┐
              │                                            │
              ▼                                            ▼
  ┌───────────────────────┐                    ┌───────────────────────┐
  │ Workers B, C get      │                    │ Edit window (3 hours) │
  │ push notification     │                    │                       │
  │ + badge               │                    │ Worker A can withdraw │
  │                       │                    │ and resubmit          │
  │ "You were added to    │                    └───────────────────────┘
  │ job at [Location]"    │
  └───────────┬───────────┘
              │
  ┌───────────┼───────────────────────────┐
  │           │                           │
  ▼           ▼                           ▼
┌─────────┐  ┌───────────────┐     ┌─────────────────┐
│ Confirm │  │ No action     │     │ Flag issue      │
│         │  │ (auto-approve │     │ (with reason)   │
│         │  │  after 24h)   │     │                 │
└────┬────┘  └───────┬───────┘     └────────┬────────┘
     │               │                      │
     │               │                      ▼
     │               │              ┌─────────────────────┐
     │               │              │ Job flagged         │
     │               │              │ approval_status:    │
     │               │              │   flagged           │
     │               │              │                     │
     │               │              │ Admin notified      │
     │               │              └──────────┬──────────┘
     │               │                         │
     ▼               ▼                         ▼
┌─────────────────────────────┐      ┌─────────────────────┐
│ Job approved                │      │ Admin resolves      │
│ approval_status: approved   │      │ → approve OR        │
│                             │      │ → cancel            │
│ Ready for invoicing/        │      └─────────────────────┘
│ payment calculation         │
└─────────────────────────────┘
```

### Status States

#### Job-level (`job.approval_status`)

| Status | Description |
|--------|-------------|
| `approved` | All workers confirmed (or auto-approved). Job is finalized. |
| `pending` | Waiting for one or more colleagues to confirm |
| `flagged` | A worker flagged an issue; needs admin review |
| `cancelled` | Admin cancelled the job |

#### Per-worker (`job_worker.confirmation_status`)

| Status | Description |
|--------|-------------|
| `confirmed` | Worker confirmed their participation |
| `pending` | Waiting for worker to confirm |
| `flagged` | Worker flagged an issue with this job |

### Timing Rules

| Rule | Default Value | Configurable |
|------|---------------|--------------|
| **Auto-approve timeout** | 24 hours | Yes, org setting |
| **Edit window (withdraw)** | 3 hours | No (fixed) |
| **Reminder notification** | 30 min before auto-approve | No (fixed) |

### Single-Worker Jobs

Jobs submitted by a single worker (no colleagues) are **auto-approved immediately** with `approval_status = 'approved'`. No confirmation flow is triggered.

## Acceptance Criteria

### Job Submission (Mobile App)

1. When a worker submits a job with colleagues:
   - Job is created with `approval_status = 'pending'`
   - `auto_approve_at` is set to `NOW() + org.colleague_confirmation_timeout_hours` (default 24)
   - `edit_window_expires_at` is set to `NOW() + 3 hours`
   - Submitting worker's `job_worker.confirmation_status = 'confirmed'`
   - All colleagues' `job_worker.confirmation_status = 'pending'`

2. When a worker submits a job without colleagues (solo job):
   - Job is created with `approval_status = 'approved'`
   - `auto_approve_at` is NULL
   - `edit_window_expires_at` is NULL
   - The worker's `job_worker.confirmation_status = 'confirmed'`

### Colleague Notifications (Mobile App)

3. When added as a colleague to a job, worker receives:
   - Push notification: "You were added to a job at [Location]. Confirm or flag by [time]."
   - Badge indicator on home/jobs tab showing pending confirmations count

4. 30 minutes before auto-approve, worker receives reminder:
   - Push notification: "Job at [Location] will auto-confirm in 30 minutes"

### Colleague Confirmation (Mobile App)

5. Worker can view pending jobs in a "Pending Confirmation" section showing:
   - Location name
   - Date/time of job
   - Other workers on the job
   - Countdown to auto-approve
   - Job details (submission data summary)

6. Worker can **Confirm** participation:
   - `job_worker.confirmation_status` → `'confirmed'`
   - `job_worker.confirmed_at` → current timestamp
   - If all workers are now confirmed, `job.approval_status` → `'approved'`

7. Worker can **Flag** an issue:
   - `job_worker.confirmation_status` → `'flagged'`
   - `job_worker.flagged_at` → current timestamp
   - `job_worker.flag_reason` → worker-provided reason (required, text input)
   - `job.approval_status` → `'flagged'`
   - Admin receives notification: "[Worker Name] flagged a job for review"

### Submitter Withdraw (Mobile App)

8. Within the edit window (3 hours), the submitting worker can **Withdraw** the job:
   - Job is deleted (or marked cancelled)
   - Colleagues receive notification: "Job at [Location] was withdrawn by [Submitter]"
   - Worker can then resubmit a new job if needed

9. After edit window expires:
   - Withdraw option is hidden/disabled
   - Original submitter cannot modify the job

### Auto-Approve (Scheduled Function)

10. A scheduled function runs periodically (e.g., every 5 minutes) to:
    - Find jobs where `approval_status = 'pending'` AND `auto_approve_at <= NOW()`
    - For each job:
      - Set all `job_worker.confirmation_status = 'pending'` → `'confirmed'`
      - Set `job_worker.confirmed_at` → current timestamp
      - Set `job.approval_status` → `'approved'`
    - Log auto-approved jobs for audit

### Admin Flagged Job Resolution (Dashboard)

11. Flagged jobs appear in a dedicated section on the dashboard:
    - "Attention Required" or similar prominent placement
    - Badge/count indicator
    - List shows: location, date, submitter, who flagged, flag reason

12. Admin can view flagged job details:
    - Full job details (location, workers, submission data)
    - Who flagged and when
    - Flag reason
    - Timeline of confirmations

13. Admin can **Approve** a flagged job:
    - `job.approval_status` → `'approved'`
    - Optionally adjust worker times or details before approving
    - Workers receive notification: "Job at [Location] was approved by admin"

14. Admin can **Cancel** a flagged job:
    - `job.approval_status` → `'cancelled'`
    - Workers receive notification: "Job at [Location] was cancelled by admin"

### Job List Updates (Dashboard & Mobile)

15. Job lists include approval status:
    - Visual indicator (badge/icon) for pending, flagged, cancelled jobs
    - Filter options for approval status
    - Approved jobs appear normally in completed jobs list

16. Jobs with `approval_status != 'approved'` should NOT be:
    - Included in invoice generation
    - Included in worker payment calculations
    - Counted in revenue/stats dashboards

## Database Schema Changes

### Job Table Additions

```sql
-- Add approval tracking columns
ALTER TABLE job ADD COLUMN approval_status TEXT 
  DEFAULT 'approved'  -- Backward compatibility for existing jobs
  CHECK (approval_status IN ('approved', 'pending', 'flagged', 'cancelled'));

ALTER TABLE job ADD COLUMN auto_approve_at TIMESTAMPTZ;

ALTER TABLE job ADD COLUMN edit_window_expires_at TIMESTAMPTZ;

-- Index for finding pending/flagged jobs
CREATE INDEX idx_job_approval_status 
  ON job(organization_id, approval_status) 
  WHERE approval_status IN ('pending', 'flagged');

-- Index for auto-approve scheduled function
CREATE INDEX idx_job_auto_approve 
  ON job(auto_approve_at) 
  WHERE approval_status = 'pending' AND auto_approve_at IS NOT NULL;

-- Comments
COMMENT ON COLUMN job.approval_status IS 'Job approval workflow status: approved (finalized), pending (awaiting colleague confirmation), flagged (needs admin review), cancelled';
COMMENT ON COLUMN job.auto_approve_at IS 'Timestamp when job will be auto-approved if no action taken';
COMMENT ON COLUMN job.edit_window_expires_at IS 'Timestamp after which submitter can no longer withdraw the job';
```

### Job Worker Table Additions

```sql
-- Add confirmation tracking columns
ALTER TABLE job_worker ADD COLUMN confirmation_status TEXT 
  DEFAULT 'confirmed'  -- Backward compatibility
  CHECK (confirmation_status IN ('confirmed', 'pending', 'flagged'));

ALTER TABLE job_worker ADD COLUMN confirmed_at TIMESTAMPTZ;

ALTER TABLE job_worker ADD COLUMN flagged_at TIMESTAMPTZ;

ALTER TABLE job_worker ADD COLUMN flag_reason TEXT;

-- Comments
COMMENT ON COLUMN job_worker.confirmation_status IS 'Worker confirmation status: confirmed, pending, or flagged';
COMMENT ON COLUMN job_worker.confirmed_at IS 'When the worker confirmed their participation';
COMMENT ON COLUMN job_worker.flagged_at IS 'When the worker flagged an issue with this job';
COMMENT ON COLUMN job_worker.flag_reason IS 'Reason provided when worker flags a job';
```

### Organization Settings Addition

```sql
-- Add colleague confirmation timeout setting
ALTER TABLE organization ADD COLUMN colleague_confirmation_timeout_hours INTEGER 
  DEFAULT 24
  CHECK (colleague_confirmation_timeout_hours >= 1 AND colleague_confirmation_timeout_hours <= 168);

COMMENT ON COLUMN organization.colleague_confirmation_timeout_hours IS 'Hours before jobs with colleagues are auto-approved (1-168, default 24)';
```

### Notification Types

Add new notification types to the existing notification system:

| Type | Recipients | Trigger |
|------|------------|---------|
| `job_confirmation_requested` | Added worker | Worker added to job as colleague |
| `job_confirmation_reminder` | Pending worker | 30 min before auto-approve |
| `job_flagged` | All admins | Worker flags a job |
| `job_withdrawn` | Colleagues | Submitter withdraws job |
| `job_resolved_approved` | All workers on job | Admin approves flagged job |
| `job_resolved_cancelled` | All workers on job | Admin cancels flagged job |
| `job_auto_approved` | Submitter | Job auto-approved after timeout |

## API Changes

### New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `confirm-job-participation` | POST | Worker confirms participation on a job |
| `flag-job` | POST | Worker flags a job with reason |
| `withdraw-job` | POST | Submitter withdraws job within edit window |
| `resolve-flagged-job` | POST | Admin approves or cancels flagged job |
| `list-pending-confirmations` | GET | List jobs pending worker's confirmation |

### Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `create-job` | Set `approval_status = 'pending'` when colleagues added; set timestamps |
| `list-jobs` | Include `approval_status`, per-worker `confirmation_status` |
| `calculate-worker-payment` | Skip jobs where `approval_status != 'approved'` |
| `auto-generate-invoices` | Skip jobs where `approval_status != 'approved'` |

### Request/Response Types

```typescript
// confirm-job-participation
interface ConfirmJobParticipationRequest {
  job_id: string;
}

// flag-job
interface FlagJobRequest {
  job_id: string;
  reason: string;  // Required, min 10 characters
}

// withdraw-job
interface WithdrawJobRequest {
  job_id: string;
}

// resolve-flagged-job
interface ResolveFlaggedJobRequest {
  job_id: string;
  action: 'approve' | 'cancel';
  admin_notes?: string;
}

// list-pending-confirmations response
interface PendingConfirmation {
  job_id: string;
  location_name: string | null;
  submitted_at: string;
  submitted_by: string;  // Worker name
  auto_approve_at: string;
  workers: Array<{
    id: string;
    name: string;
    confirmation_status: 'confirmed' | 'pending' | 'flagged';
  }>;
  submission_summary: Record<string, unknown>;  // Key fields from submission_data
}
```

## UI/UX Specifications

### Mobile App: Pending Confirmations

**Location**: Home tab or dedicated "Pending" section in Jobs

**Card Design**:
```
┌─────────────────────────────────────────┐
│ 📍 City Motors                          │
│ Feb 14, 2026 • 2:30 PM                  │
│                                         │
│ Workers: You, Alice, Bob                │
│ Submitted by: Alice                     │
│                                         │
│ ⏱️ Auto-confirms in 23h 45m             │
│                                         │
│ [View Details]                          │
│                                         │
│ ┌─────────────┐  ┌─────────────┐        │
│ │  ✓ Confirm  │  │  ⚠ Flag     │        │
│ └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────┘
```

**Flag Flow**:
1. Tap "Flag" button
2. Modal appears: "What's the issue?"
3. Text input (required, min 10 chars): e.g., "I wasn't at this location on this date"
4. Submit → confirmation toast

### Mobile App: Badge

- Badge on home tab or jobs tab showing count of pending confirmations
- Badge clears when all pending jobs are confirmed/flagged/auto-approved

### Dashboard: Flagged Jobs Section

**Location**: Completed Jobs page, above the job list, or dedicated section

**Design**:
```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Attention Required (2 jobs)                                  │
├─────────────────────────────────────────────────────────────────┤
│ City Motors • Feb 14, 2026                                      │
│ Flagged by: Bob Smith                                           │
│ Reason: "I wasn't there - Alice submitted without me"          │
│ [View] [Approve] [Cancel]                                       │
├─────────────────────────────────────────────────────────────────┤
│ Budget Cars • Feb 13, 2026                                      │
│ Flagged by: Charlie Brown                                       │
│ Reason: "Wrong hours recorded - I only worked 4 hours"         │
│ [View] [Approve] [Cancel]                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Dashboard: Job List Status Indicators

| Status | Badge/Icon | Color |
|--------|-----------|-------|
| Approved | ✓ or none | Green / default |
| Pending | ⏳ | Yellow/amber |
| Flagged | ⚠️ | Red/orange |
| Cancelled | ✕ | Gray |

## Testing Considerations

### Unit Tests

1. `create-job`:
   - With colleagues → `approval_status = 'pending'`, timestamps set correctly
   - Without colleagues → `approval_status = 'approved'`, no timestamps

2. `confirm-job-participation`:
   - Confirms the worker's status
   - When all confirmed → job becomes approved
   - Rejects if worker not on job
   - Rejects if job not pending

3. `flag-job`:
   - Sets worker and job status
   - Requires reason
   - Rejects if already flagged/approved

4. `withdraw-job`:
   - Within window → succeeds
   - Outside window → fails
   - Not submitter → fails

5. Auto-approve function:
   - Approves jobs past deadline
   - Doesn't touch flagged jobs
   - Handles edge cases (no pending workers, etc.)

### Integration Tests

1. Full flow: Submit → Confirm → Approved
2. Full flow: Submit → Flag → Admin resolve
3. Full flow: Submit → Timeout → Auto-approve
4. Withdraw within window
5. Notifications sent correctly
6. Flagged jobs excluded from payments/invoices

## Implementation Priority

### Phase 1: Core Backend (Essential)
1. Database migrations (job + job_worker columns, org setting)
2. Update `create-job` to set pending status
3. `confirm-job-participation` endpoint
4. `flag-job` endpoint
5. `resolve-flagged-job` endpoint
6. Update `list-jobs` to include approval status

### Phase 2: Auto-Approve & Notifications
7. Auto-approve scheduled function
8. Notification triggers (confirmation requested, flagged, etc.)
9. `withdraw-job` endpoint

### Phase 3: Mobile App
10. Pending confirmations UI
11. Confirm/flag actions
12. Badge indicator
13. Withdraw UI (within edit window)

### Phase 4: Dashboard
14. Flagged jobs admin view
15. Resolve actions
16. Job status badges in lists
17. Organization setting for timeout

### Phase 5: Guards & Cleanup
18. Update `calculate-worker-payment` to skip non-approved jobs
19. Update `auto-generate-invoices` to skip non-approved jobs
20. Update stats/dashboard queries to filter by approval status

## Related Documentation

- [Notification system](../../decisions/notification-system.md)
- [Admin notifications (006)](../admin-users/006-admin-notifications.md)
- [Worker payment rates and splits (007)](../workers/007-worker-payment-rates-and-splits.md)
- [Completed jobs display (001)](../completed-jobs/001-completed-jobs-display-and-audit.md)

## Notes

- This feature should be **backward compatible**: existing jobs remain `approved`
- The confirmation flow only triggers for **mobile-submitted jobs with colleagues**
- Dashboard-created jobs (admin-create-job) could optionally skip confirmation (org setting) since admin is creating the record
- Consider future enhancement: allow workers to adjust their own times when confirming (for time-based payment splits)
