-- Clean up all placeholder data
-- This will delete all data from all tables

-- Delete in order of dependencies (child tables first)
DELETE FROM notifications;
DELETE FROM timesheet_edits;
DELETE FROM timesheets;
DELETE FROM work_sessions;
DELETE FROM shift_interests;
DELETE FROM shifts;
DELETE FROM schedule_history;
DELETE FROM schedules;
DELETE FROM coverage_templates;
DELETE FROM availability;
DELETE FROM documents;
DELETE FROM worker_places;
DELETE FROM worker_skills;
DELETE FROM users;
DELETE FROM places;
DELETE FROM skills;
DELETE FROM companies;

-- Reset sequences if any
-- ALTER SEQUENCE IF EXISTS companies_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS places_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS skills_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS schedules_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS shifts_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS availability_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS work_sessions_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS timesheets_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS timesheet_edits_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS documents_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS notifications_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS worker_skills_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS worker_places_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS shift_interests_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS schedule_history_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS coverage_templates_id_seq RESTART WITH 1;
