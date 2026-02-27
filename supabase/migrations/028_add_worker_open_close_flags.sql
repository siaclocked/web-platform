-- ============================================
-- Migration 028: Ensure worker open/close flags exist
-- ============================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS can_open BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS can_close BOOLEAN NOT NULL DEFAULT true;
