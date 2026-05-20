-- Add status tracking + approval flow to work_sessions
--
-- Lifecycle:
--   active          -> currently clocked in (no end_time)
--   clocked_out     -> worker manually clocked out
--   auto_closed     -> auto-closed by the server when scheduled shift ended + grace
--   pending_review  -> worker (or manager) edited start/end after clock-out; awaiting manager approval
--   approved        -> manager approved; row is treated as authoritative for payroll/hours
--
-- Only `approved` sessions should count toward worker hours totals for payroll.

ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'clocked_out', 'auto_closed', 'pending_review', 'approved'));

-- Track who approved + when, for audit
ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill: any existing row with end_time IS NULL is still active; with end_time is clocked_out
UPDATE work_sessions SET status = 'active' WHERE end_time IS NULL AND status IS NULL;
UPDATE work_sessions SET status = 'clocked_out' WHERE end_time IS NOT NULL AND status IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_sessions_status ON work_sessions(status);
