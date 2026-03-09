-- ============================================
-- Migration 031: Add worker monthly hour targets
-- ============================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS monthly_min_hours DECIMAL(8, 2) DEFAULT NULL;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS monthly_optimal_hours DECIMAL(8, 2) DEFAULT NULL;

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_monthly_hours_non_negative;

ALTER TABLE users
ADD CONSTRAINT users_monthly_hours_non_negative
CHECK (
  (monthly_min_hours IS NULL OR monthly_min_hours >= 0) AND
  (monthly_optimal_hours IS NULL OR monthly_optimal_hours >= 0)
);

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_monthly_hours_order;

ALTER TABLE users
ADD CONSTRAINT users_monthly_hours_order
CHECK (
  monthly_min_hours IS NULL OR
  monthly_optimal_hours IS NULL OR
  monthly_min_hours <= monthly_optimal_hours
);
