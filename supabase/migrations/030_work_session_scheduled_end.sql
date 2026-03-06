-- Add scheduled_end_minutes to work_sessions for auto clock-out tracking
ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS scheduled_end_minutes INTEGER DEFAULT NULL;
