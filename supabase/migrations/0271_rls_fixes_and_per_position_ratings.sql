-- ============================================
-- Migration 027: RLS Policy Fixes + Per-Position Ratings
-- ============================================
-- 1. Add missing RLS policies for: schedule_history, shift_interests, timesheet_edits
-- 2. Standardize schedule_templates + shift_templates policies to use get_user_company_id()
-- 3. Change worker_skills.rating from 1-5 to 1-10 scale
-- 4. Drop users.worker_rating column (replaced by per-skill ratings)

-- =============================================
-- PART 1: Missing RLS policies
-- =============================================

-- schedule_history: managers can view/insert, workers can view published
CREATE POLICY "Managers can view schedule history"
  ON schedule_history FOR SELECT
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM schedules s
      JOIN places p ON p.id = s.place_id
      WHERE s.id = schedule_history.schedule_id
      AND p.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Managers can insert schedule history"
  ON schedule_history FOR INSERT
  WITH CHECK (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM schedules s
      JOIN places p ON p.id = s.place_id
      WHERE s.id = schedule_history.schedule_id
      AND p.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Workers can view published schedule history"
  ON schedule_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM schedules s
      JOIN worker_places wp ON wp.place_id = s.place_id AND wp.is_active = true
      WHERE s.id = schedule_history.schedule_id
      AND s.status = 'PUBLISHED'
      AND wp.worker_id = auth.uid()
    )
  );

-- shift_interests: workers can manage own interests, managers can view/manage for company
CREATE POLICY "Workers can view their own shift interests"
  ON shift_interests FOR SELECT
  USING (worker_id = auth.uid());

CREATE POLICY "Workers can insert their own shift interests"
  ON shift_interests FOR INSERT
  WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Workers can update their own shift interests"
  ON shift_interests FOR UPDATE
  USING (worker_id = auth.uid());

CREATE POLICY "Workers can delete their own shift interests"
  ON shift_interests FOR DELETE
  USING (worker_id = auth.uid());

CREATE POLICY "Managers can view shift interests for their company"
  ON shift_interests FOR SELECT
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM shifts sh
      JOIN places p ON p.id = sh.place_id
      WHERE sh.id = shift_interests.shift_id
      AND p.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Managers can manage shift interests for their company"
  ON shift_interests FOR ALL
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM shifts sh
      JOIN places p ON p.id = sh.place_id
      WHERE sh.id = shift_interests.shift_id
      AND p.company_id = get_user_company_id()
    )
  );

-- timesheet_edits: workers can view edits to their sessions, managers can view/insert for company
CREATE POLICY "Workers can view edits to their own sessions"
  ON timesheet_edits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM work_sessions ws
      WHERE ws.id = timesheet_edits.work_session_id
      AND ws.worker_id = auth.uid()
    )
  );

CREATE POLICY "Managers can view timesheet edits for their company"
  ON timesheet_edits FOR SELECT
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM work_sessions ws
      JOIN places p ON p.id = ws.place_id
      WHERE ws.id = timesheet_edits.work_session_id
      AND p.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Managers can insert timesheet edits for their company"
  ON timesheet_edits FOR INSERT
  WITH CHECK (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM work_sessions ws
      JOIN places p ON p.id = ws.place_id
      WHERE ws.id = timesheet_edits.work_session_id
      AND p.company_id = get_user_company_id()
    )
  );

-- =============================================
-- PART 2: Standardize schedule_templates + shift_templates policies
-- =============================================

-- Drop old JWT-based policies
DROP POLICY IF EXISTS "Managers can view their company schedule templates" ON schedule_templates;
DROP POLICY IF EXISTS "Managers can insert their company schedule templates" ON schedule_templates;
DROP POLICY IF EXISTS "Managers can update their company schedule templates" ON schedule_templates;
DROP POLICY IF EXISTS "Managers can delete their company schedule templates" ON schedule_templates;

-- Recreate using get_user_company_id() for consistency
CREATE POLICY "Users can view schedule templates in their company"
  ON schedule_templates FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Managers can insert schedule templates"
  ON schedule_templates FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND get_user_role() IN ('admin', 'manager')
  );

CREATE POLICY "Managers can update schedule templates"
  ON schedule_templates FOR UPDATE
  USING (
    company_id = get_user_company_id()
    AND get_user_role() IN ('admin', 'manager')
  );

CREATE POLICY "Managers can delete schedule templates"
  ON schedule_templates FOR DELETE
  USING (
    company_id = get_user_company_id()
    AND get_user_role() IN ('admin', 'manager')
  );

-- Drop old JWT-based shift_templates policies
DROP POLICY IF EXISTS "Managers can view shift templates for their company" ON shift_templates;
DROP POLICY IF EXISTS "Managers can insert shift templates for their company" ON shift_templates;
DROP POLICY IF EXISTS "Managers can update shift templates for their company" ON shift_templates;
DROP POLICY IF EXISTS "Managers can delete shift templates for their company" ON shift_templates;

-- Recreate using get_user_company_id()
CREATE POLICY "Users can view shift templates in their company"
  ON shift_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM schedule_templates st
      WHERE st.id = shift_templates.schedule_template_id
      AND st.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Managers can insert shift templates"
  ON shift_templates FOR INSERT
  WITH CHECK (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM schedule_templates st
      WHERE st.id = shift_templates.schedule_template_id
      AND st.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Managers can update shift templates"
  ON shift_templates FOR UPDATE
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM schedule_templates st
      WHERE st.id = shift_templates.schedule_template_id
      AND st.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Managers can delete shift templates"
  ON shift_templates FOR DELETE
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM schedule_templates st
      WHERE st.id = shift_templates.schedule_template_id
      AND st.company_id = get_user_company_id()
    )
  );

-- Also fix schedule_publish_history: allow all managers in company (not just the creator)
DROP POLICY IF EXISTS "Managers can view publish history" ON schedule_publish_history;
DROP POLICY IF EXISTS "Managers can insert publish history" ON schedule_publish_history;

CREATE POLICY "Managers can view publish history"
  ON schedule_publish_history FOR SELECT USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM schedule_templates st
      WHERE st.id = schedule_publish_history.schedule_template_id
      AND st.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Managers can insert publish history"
  ON schedule_publish_history FOR INSERT WITH CHECK (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM schedule_templates st
      WHERE st.id = schedule_publish_history.schedule_template_id
      AND st.company_id = get_user_company_id()
    )
  );

-- =============================================
-- PART 3: Per-position ratings (1-10 scale)
-- =============================================

-- Change worker_skills.rating from 1-5 to 1-10
ALTER TABLE worker_skills DROP CONSTRAINT IF EXISTS worker_skills_rating_check;
ALTER TABLE worker_skills ALTER COLUMN rating SET DEFAULT 5;
ALTER TABLE worker_skills ADD CONSTRAINT worker_skills_rating_check CHECK (rating >= 1 AND rating <= 10);

-- Scale existing ratings from 1-5 to 1-10 (multiply by 2)
UPDATE worker_skills SET rating = LEAST(rating * 2, 10) WHERE rating <= 5;

-- Drop the overall worker_rating from users (replaced by per-skill ratings)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_worker_rating_check;
ALTER TABLE users DROP COLUMN IF EXISTS worker_rating;
