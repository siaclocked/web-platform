-- ============================================
-- Migration 018: Clean up dead/legacy tables and columns
-- ============================================
-- 
-- AUDIT SUMMARY (Feb 2026):
--
-- DEAD tables (zero usage in app code):
--   positions, shift_timeframes, shift_slots, worker_shift_assignments,
--   shift_interests, timesheets, timesheet_edits, documents
--
-- LEGACY tables (only used by orphaned /api/schedules/* routes, not connected to any UI):
--   schedules, shifts, schedule_history, coverage_templates, availability
--
-- GHOST tables (referenced in 017 RLS fix but never created):
--   folders, document_permissions
--
-- DEAD columns on users:
--   position_id (FK to dead positions table)
--
-- ACTIVE tables (confirmed in use by current app):
--   companies, users, places, skills, worker_skills, worker_places,
--   schedule_templates, shift_templates, worker_availability_submissions,
--   work_sessions, notifications
--
-- NOTE: This migration drops dead tables. Legacy tables (schedules, shifts,
-- schedule_history, coverage_templates, availability) are KEPT because they
-- may be needed when the full scheduling flow is rebuilt per requirements.md.
-- They will be refactored in a future migration.
--

-- ============================================
-- 1. Drop dead column on users
-- ============================================

ALTER TABLE users DROP COLUMN IF EXISTS position_id;

-- ============================================
-- 2. Drop dead tables (reverse dependency order)
-- ============================================

-- From migration 009: positions + shift planning (replaced by schedule_templates flow)
DROP TABLE IF EXISTS worker_shift_assignments CASCADE;
DROP TABLE IF EXISTS shift_slots CASCADE;
DROP TABLE IF EXISTS shift_timeframes CASCADE;
DROP TABLE IF EXISTS positions CASCADE;

-- shift_interests: never used in app code
DROP TABLE IF EXISTS shift_interests CASCADE;

-- timesheets + timesheet_edits: never queried in app code
DROP TABLE IF EXISTS timesheet_edits CASCADE;
DROP TABLE IF EXISTS timesheets CASCADE;

-- documents: feature is on hold per requirements.md §2.2
DROP TABLE IF EXISTS documents CASCADE;

-- ============================================
-- 3. Drop RLS policies for ghost tables (folders, document_permissions)
--    These were added in 017 but the tables were never created.
--    Safe to attempt drop even if they don't exist.
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'folders') THEN
    DROP TABLE folders CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_permissions') THEN
    DROP TABLE document_permissions CASCADE;
  END IF;
END;
$$;

-- ============================================
-- 4. Clean up orphaned indexes that reference dropped tables
-- ============================================

DROP INDEX IF EXISTS idx_positions_company_manager;
DROP INDEX IF EXISTS idx_shift_timeframes_company;
DROP INDEX IF EXISTS idx_shift_slots_timeframe;
DROP INDEX IF EXISTS idx_shift_slots_date;
DROP INDEX IF EXISTS idx_worker_assignments_worker;
DROP INDEX IF EXISTS idx_worker_assignments_shift;
DROP INDEX IF EXISTS idx_documents_worker;
