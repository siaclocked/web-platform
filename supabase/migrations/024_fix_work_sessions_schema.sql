-- ============================================
-- Migration 024: Fix work_sessions schema for simplified clock-in
-- 1. Make skill_id nullable (position no longer required for clock-in)
-- 2. Add 'NEXT_AT_PLACE' to handoff_audience CHECK constraint
-- ============================================

-- 1. Make skill_id nullable
ALTER TABLE work_sessions ALTER COLUMN skill_id DROP NOT NULL;

-- 2. Drop old handoff_audience CHECK and add updated one
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'work_sessions' AND column_name = 'handoff_audience'
  ) THEN
    ALTER TABLE work_sessions DROP CONSTRAINT IF EXISTS work_sessions_handoff_audience_check;
  END IF;
END $$;

ALTER TABLE work_sessions ADD CONSTRAINT work_sessions_handoff_audience_check
  CHECK (handoff_audience IN ('NEXT_IN_SKILL', 'NEXT_SHIFT_ALL', 'NEXT_AT_PLACE'));

-- 3. Update worker_rating constraint on users table to 1-10 (if still 1-5)
DO $$
BEGIN
  -- Drop old constraint and re-add with 1-10 range
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_worker_rating_check;
  ALTER TABLE users ADD CONSTRAINT users_worker_rating_check CHECK (worker_rating >= 1 AND worker_rating <= 10);
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 4. Update default for worker_rating to 5
ALTER TABLE users ALTER COLUMN worker_rating SET DEFAULT 5;
