# Mobile App Changes Plan

This document outlines the changes needed to the mobile app to support:
1. **Job Colleague Confirmation Workflow** - Workers confirm/flag jobs submitted by colleagues
2. **Per-Worker Time Entry** - Optional toggle to enter different start/finish times for each colleague

---

## Current State Summary

### Already Implemented ✅

| Feature | Location | Status |
|---------|----------|--------|
| Colleague selection in job submission | `new-entry.tsx` | ✅ Working |
| Pending confirmations screen | `pending-confirmations.tsx` | ✅ Working |
| Confirm job participation | `pending-confirmations.tsx` → `confirm-job-participation` | ✅ Working |
| Flag job with reason | `pending-confirmations.tsx` → `flag-job` | ✅ Working |
| Tab badge for pending confirmations | `_layout.tsx` + `use-pending-confirmations-count.ts` | ✅ Working |
| Single start/finish time for all workers | `new-entry.tsx` | ✅ Working |

### Not Yet Implemented ❌

| Feature | Priority | Complexity |
|---------|----------|------------|
| Per-worker time entry (toggle) | Medium | Medium |
| Job withdrawal (by submitter) | High | Low |
| Show approval status in jobs list | Medium | Low |
| Show approval status in job detail | Medium | Low |
| Real-time updates for confirmations | Low | Medium |

---

## Detailed Change Plan

### 1. Per-Worker Time Entry Toggle (Medium Priority)

**User Story:** When a worker submits a job with colleagues, they can optionally toggle "Different times for each worker" to enter individual start/finish times.

**Files to modify:**
- `mobile-app/app/(tabs)/new-entry.tsx`
- `mobile-app/hooks/use-entry-form.ts` (if needed)

**Implementation:**

```typescript
// State additions in new-entry.tsx
const [useIndividualTimes, setUseIndividualTimes] = useState(false);
const [workerTimes, setWorkerTimes] = useState<Record<string, { 
  startTime: Date | undefined; 
  finishTime: Date | undefined; 
}>>({});

// When colleagues are selected, initialize their times
useEffect(() => {
  if (selectedColleagues.length > 0) {
    const times: Record<string, { startTime: Date | undefined; finishTime: Date | undefined }> = {};
    selectedColleagues.forEach(id => {
      times[id] = { 
        startTime: startTime, // Default to job's shared time
        finishTime: finishTime 
      };
    });
    setWorkerTimes(times);
  }
}, [selectedColleagues]);
```

**UI Changes:**

```tsx
{/* After colleague badges, before time pickers */}
{selectedColleagues.length > 1 && (
  <View className="flex-row items-center justify-between py-3">
    <Text className="text-sm text-foreground">
      Different times for each worker
    </Text>
    <Switch
      value={useIndividualTimes}
      onValueChange={setUseIndividualTimes}
    />
  </View>
)}

{/* If toggle is ON, show per-worker time pickers */}
{useIndividualTimes && selectedColleagues.map(colleagueId => (
  <View key={colleagueId} className="border-t border-border pt-3 mt-3">
    <Text className="text-sm font-medium text-foreground mb-2">
      {getColleagueName(colleagueId)}
    </Text>
    <View className="flex-row gap-3">
      <DateTimePicker
        label="Started"
        value={workerTimes[colleagueId]?.startTime}
        onChange={(date) => handleWorkerTimeChange(colleagueId, 'startTime', date)}
      />
      <DateTimePicker
        label="Finished"
        value={workerTimes[colleagueId]?.finishTime}
        onChange={(date) => handleWorkerTimeChange(colleagueId, 'finishTime', date)}
      />
    </View>
  </View>
))}
```

**Submission Data Changes:**

```typescript
// In handleSubmit, modify the submission data
if (useIndividualTimes && selectedColleagues.length > 1) {
  submissionData.worker_times = selectedColleagues.map(id => ({
    worker_id: id,
    start_time: workerTimes[id]?.startTime?.toISOString(),
    finish_time: workerTimes[id]?.finishTime?.toISOString(),
  }));
} else {
  // Use shared times for all workers (current behavior)
  submissionData.start_time = startTime?.toISOString();
  submissionData.finish_time = finishTime?.toISOString();
}
```

**Backend Changes Required:**
- `create-job` edge function already accepts `worker_times` array in `submission_data`
- No database changes needed (stored in `submission_data` JSONB)

---

### 2. Job Withdrawal Feature (High Priority)

**User Story:** A worker who submitted a job can withdraw it within 3 hours if they made a mistake.

**Files to create/modify:**
- `mobile-app/app/(tabs)/jobs.tsx` - Add withdraw button
- Create new hook: `mobile-app/hooks/use-job-actions.ts`

**Implementation:**

```typescript
// hooks/use-job-actions.ts
export function useJobActions() {
  const { session } = useAuth();
  
  const withdrawJob = async (jobId: string) => {
    const { data, error } = await supabase.functions.invoke("withdraw-job", {
      body: { job_id: jobId },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    
    if (error) throw error;
    return data;
  };
  
  return { withdrawJob };
}
```

**UI Changes in jobs.tsx:**

```tsx
// Add to job card
{job.submitted_by_worker_id === worker?.id && 
 job.approval_status === 'pending' &&
 job.edit_window_expires_at && 
 new Date(job.edit_window_expires_at) > new Date() && (
  <Pressable
    onPress={() => handleWithdraw(job.id)}
    className="mt-3 flex-row items-center justify-center gap-2 py-2 bg-destructive/10 rounded-lg"
  >
    <Ionicons name="trash-outline" size={16} color="rgb(220 38 38)" />
    <Text className="text-destructive font-medium">
      Withdraw ({getTimeRemaining(job.edit_window_expires_at)})
    </Text>
  </Pressable>
)}
```

---

### 3. Show Approval Status in Jobs List (Medium Priority)

**User Story:** Workers can see which jobs are pending approval, approved, flagged, or cancelled.

**Files to modify:**
- `mobile-app/app/(tabs)/jobs.tsx`

**Implementation:**

```tsx
// Add status badge to job cards
const getStatusBadge = (job: Job) => {
  switch (job.approval_status) {
    case 'pending':
      return (
        <View className="bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full">
          <Text className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
            Pending
          </Text>
        </View>
      );
    case 'flagged':
      return (
        <View className="bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
          <Text className="text-xs font-medium text-red-700 dark:text-red-400">
            Flagged
          </Text>
        </View>
      );
    case 'cancelled':
      return (
        <View className="bg-gray-100 dark:bg-gray-900/30 px-2 py-0.5 rounded-full">
          <Text className="text-xs font-medium text-gray-700 dark:text-gray-400">
            Cancelled
          </Text>
        </View>
      );
    default:
      return null; // Don't show badge for approved jobs
  }
};
```

**Update Job Interface:**

```typescript
interface Job {
  id: string;
  created_at: string;
  location_name?: string;
  worker_name?: string;
  approval_status?: 'approved' | 'pending' | 'flagged' | 'cancelled';
  submitted_by_worker_id?: string | null;
  edit_window_expires_at?: string | null;
  auto_approve_at?: string | null;
  workers?: Array<{
    id: string;
    name: string;
    confirmation_status?: string;
  }>;
  [key: string]: any;
}
```

---

### 4. Job Detail Screen (Low Priority - Future)

**User Story:** Workers can tap a job to see full details including worker confirmation statuses.

**Files to create:**
- `mobile-app/app/(tabs)/job/[id].tsx` or `mobile-app/app/modal.tsx` (job detail modal)

This would show:
- Full job submission data
- All workers with their confirmation status
- Auto-approve countdown (if pending)
- Withdraw button (if applicable)

---

### 5. Real-Time Updates (Low Priority - Future)

**User Story:** Pending confirmations list updates automatically when a colleague confirms/flags.

**Files to modify:**
- `mobile-app/app/(tabs)/pending-confirmations.tsx`
- `mobile-app/hooks/use-pending-confirmations-count.ts`

**Implementation:**
Use Supabase Realtime to subscribe to `job_worker` changes filtered by organization.

```typescript
useEffect(() => {
  if (!organizationId) return;
  
  const channel = supabase
    .channel(`confirmations:${organizationId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'job_worker',
      // Note: Can't filter by organization_id directly, need to check in handler
    }, () => {
      fetchConfirmations(); // Refetch on any change
    })
    .subscribe();
    
  return () => void supabase.removeChannel(channel);
}, [organizationId]);
```

---

## Implementation Order (Recommended)

| Phase | Feature | Effort | Impact |
|-------|---------|--------|--------|
| **1** | Show approval status in jobs list | 2h | High - visibility |
| **2** | Job withdrawal feature | 3h | High - error correction |
| **3** | Per-worker time entry toggle | 4h | Medium - time tracking accuracy |
| **4** | Job detail screen | 4h | Low - nice to have |
| **5** | Real-time updates | 3h | Low - polish |

---

## Testing Checklist

### Per-Worker Time Entry
- [ ] Toggle appears only when 2+ colleagues selected
- [ ] Default times match shared job times
- [ ] Individual times can be set per worker
- [ ] Validation: end time > start time for each worker
- [ ] Submission data includes `worker_times` array when toggle ON
- [ ] Submission data includes shared `start_time`/`finish_time` when toggle OFF

### Job Withdrawal
- [ ] Withdraw button only shows for submitter
- [ ] Withdraw button only shows for pending jobs
- [ ] Withdraw button shows countdown timer
- [ ] Withdraw button disappears after 3 hours
- [ ] Withdrawal removes job from list
- [ ] Error handling for expired window

### Approval Status Display
- [ ] Pending jobs show yellow badge
- [ ] Flagged jobs show red badge
- [ ] Cancelled jobs show gray badge
- [ ] Approved jobs show no badge (clean)
- [ ] Jobs list filters correctly for workers vs admins

---

## Dependencies

### Edge Functions (Already Exist)
- `create-job` - Handles `worker_times` in submission_data ✅
- `withdraw-job` - Job withdrawal ✅
- `list-jobs` - Returns `approval_status`, `submitted_by_worker_id`, etc. (needs verification)
- `confirm-job-participation` - Worker confirmation ✅
- `flag-job` - Worker flagging ✅

### Database (Already Migrated)
- `job.approval_status` ✅
- `job.submitted_by_worker_id` ✅
- `job.edit_window_expires_at` ✅
- `job.auto_approve_at` ✅
- `job_worker.confirmation_status` ✅

---

## Notes

1. **Toggle Default:** The "Different times for each worker" toggle should default to OFF for simplicity
2. **Time Validation:** Ensure each worker's end time is after their start time
3. **UX Consideration:** When toggle is turned OFF after setting individual times, the shared time should be used for all
4. **Backend Compatibility:** The `create-job` function already supports `worker_times` array per user story 007

---

*Last Updated: 2026-02-14*
