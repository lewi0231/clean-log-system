-- -*- mode: sql; sql-product: postgres -*-
-- Add 'approved' status to worker_payment_batch status enum
-- This allows batches to be marked as approved after review, before payment processing

-- Drop existing constraint
ALTER TABLE worker_payment_batch
  DROP CONSTRAINT IF EXISTS worker_payment_batch_status_check;

-- Add new constraint with 'approved' status
ALTER TABLE worker_payment_batch
  ADD CONSTRAINT worker_payment_batch_status_check
  CHECK (status IN (
    'calculated',  -- Payment calculated but not yet processed
    'approved',    -- Reviewed and approved, ready for payment
    'processing',  -- Payments being processed
    'completed',   -- All payments completed
    'cancelled'    -- Batch cancelled
  ));

COMMENT ON COLUMN worker_payment_batch.status IS 'Batch status: calculated (initial), approved (reviewed and ready), processing (in progress), completed (all paid), cancelled';

