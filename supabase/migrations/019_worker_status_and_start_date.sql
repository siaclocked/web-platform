-- ============================================
-- Migration 019: Add worker status and start_date fields
-- ============================================
--
-- Adds:
--   users.status  VARCHAR(20) — INVITED / ACTIVE / DISABLED
--   users.start_date  DATE — solver eligibility date
--
-- The existing boolean is_active is kept for backward compatibility.
-- New code should read status; is_active is derived.

-- 1. Add status column with default 'ACTIVE' for existing rows
ALTER TABLE users
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE'
  CHECK (status IN ('INVITED', 'ACTIVE', 'DISABLED'));

-- 2. Sync existing is_active = false rows to DISABLED
UPDATE users SET status = 'DISABLED' WHERE is_active = false AND status = 'ACTIVE';

-- 3. Add start_date column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT NULL;

-- 4. Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
