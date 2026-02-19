-- ============================================
-- Migration 023: Ensure start_date, status columns on users table
-- Also adds a worker_rating column to users for overall manager-set rating
-- ============================================

-- 1. Add status column (INVITED / ACTIVE / DISABLED)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'status'
  ) THEN
    ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE';
    ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('INVITED', 'ACTIVE', 'DISABLED'));
  END IF;
END $$;

-- 2. Sync existing is_active = false rows to DISABLED
UPDATE users SET status = 'DISABLED' WHERE is_active = false AND status = 'ACTIVE';

-- 3. Add start_date column (date the worker starts working)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE users ADD COLUMN start_date DATE DEFAULT NULL;
  END IF;
END $$;

-- 4. Add worker_rating column (overall rating set by manager, 1-5)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'worker_rating'
  ) THEN
    ALTER TABLE users ADD COLUMN worker_rating INTEGER DEFAULT 3;
    ALTER TABLE users ADD CONSTRAINT users_worker_rating_check CHECK (worker_rating >= 1 AND worker_rating <= 5);
  END IF;
END $$;

-- 5. Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
