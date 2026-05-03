-- Remove worker_payment rows for given jobs from open batches, excluding a new batch (post-insert cleanup).
-- Used by save-worker-payment after inserting a replacement batch so old open rows are removed atomically
-- with batch cancellation for emptied batches.

CREATE OR REPLACE FUNCTION public.worker_payment_remove_open_rows_for_jobs(
  p_organization_id uuid,
  p_job_ids uuid[],
  p_exclude_batch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH del AS (
    DELETE FROM worker_payment wp
    USING worker_payment_batch wpb
    WHERE wp.batch_id = wpb.id
      AND wp.organization_id = p_organization_id
      AND wp.job_id = ANY(p_job_ids)
      AND wpb.organization_id = p_organization_id
      AND wpb.status IN ('calculated', 'approved', 'processing')
      AND (p_exclude_batch_id IS NULL OR wp.batch_id <> p_exclude_batch_id)
    RETURNING wp.batch_id
  ),
  uniq AS (SELECT DISTINCT batch_id FROM del),
  cancelled AS (
    UPDATE worker_payment_batch wpb
    SET status = 'cancelled', updated_at = now()
    WHERE wpb.id IN (SELECT batch_id FROM uniq)
      AND wpb.organization_id = p_organization_id
      AND NOT EXISTS (
        SELECT 1 FROM worker_payment wp2 WHERE wp2.batch_id = wpb.id
      )
    RETURNING wpb.id
  )
  SELECT jsonb_build_object(
    'deleted_row_count', COALESCE((SELECT COUNT(*)::int FROM del), 0),
    'batches_cancelled', COALESCE((SELECT COUNT(*)::int FROM cancelled), 0)
  );
$$;

COMMENT ON FUNCTION public.worker_payment_remove_open_rows_for_jobs IS
  'Deletes worker_payment rows for jobs from calculated/approved/processing batches, optionally excluding a batch id (new save). Cancels emptied batches.';

REVOKE ALL ON FUNCTION public.worker_payment_remove_open_rows_for_jobs(uuid, uuid[], uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.worker_payment_remove_open_rows_for_jobs(uuid, uuid[], uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.worker_payment_remove_open_rows_for_jobs(uuid, uuid[], uuid) TO service_role;

CREATE INDEX IF NOT EXISTS idx_worker_payment_org_job
  ON public.worker_payment (organization_id, job_id);
