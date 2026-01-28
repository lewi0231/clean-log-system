-- Clarify submitted_by_email: populated for both dashboard-created and worker-created (mobile) jobs

COMMENT ON COLUMN job.submitted_by_email IS 'Email of the user who created/submitted this job (dashboard admin or worker via mobile app).';
