-- Add admin_feedback column and needs_info status to investor_applications
-- This enables the admin to send a message back to applicants requesting more info.

ALTER TABLE investor_applications
  ADD COLUMN IF NOT EXISTS admin_feedback text;

-- Extend the status check to include 'needs_info'
ALTER TABLE investor_applications
  DROP CONSTRAINT IF EXISTS investor_applications_status_check;

ALTER TABLE investor_applications
  ADD CONSTRAINT investor_applications_status_check
    CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'needs_info'));
