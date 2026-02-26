-- ============================================
-- Migration 025: Add has_password flag for manager password auth
-- Managers will use email+password login instead of OTP.
-- This flag tracks whether a manager has set their password yet.
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS has_password BOOLEAN DEFAULT false;

-- Set has_password = false for all existing managers who haven't set a password
UPDATE users SET has_password = false WHERE role = 'manager' AND has_password IS NULL;
