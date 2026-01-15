-- Row Level Security Policies for Clocked

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_templates ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS VARCHAR AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Companies policies
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  USING (id = get_user_company_id());

CREATE POLICY "Admins can update their company"
  ON companies FOR UPDATE
  USING (id = get_user_company_id() AND get_user_role() = 'admin');

-- Users policies
CREATE POLICY "Users can view users in their company"
  ON users FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can insert managers"
  ON users FOR INSERT
  WITH CHECK (
    get_user_role() = 'admin' 
    AND company_id = get_user_company_id() 
    AND role = 'manager'
  );

CREATE POLICY "Managers can insert workers"
  ON users FOR INSERT
  WITH CHECK (
    get_user_role() = 'manager' 
    AND company_id = get_user_company_id() 
    AND role = 'worker'
  );

CREATE POLICY "Managers can update workers"
  ON users FOR UPDATE
  USING (
    get_user_role() = 'manager' 
    AND company_id = get_user_company_id() 
    AND role = 'worker'
  );

-- Places policies
CREATE POLICY "Users can view places in their company"
  ON places FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Managers can manage places"
  ON places FOR ALL
  USING (
    company_id = get_user_company_id() 
    AND get_user_role() IN ('admin', 'manager')
  );

-- Skills policies
CREATE POLICY "Users can view skills in their company"
  ON skills FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Managers can manage skills"
  ON skills FOR ALL
  USING (
    company_id = get_user_company_id() 
    AND get_user_role() IN ('admin', 'manager')
  );

-- Worker skills policies
CREATE POLICY "Users can view worker skills in their company"
  ON worker_skills FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = worker_skills.worker_id 
      AND users.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Managers can manage worker skills"
  ON worker_skills FOR ALL
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = worker_skills.worker_id 
      AND users.company_id = get_user_company_id()
    )
  );

-- Worker places policies
CREATE POLICY "Users can view worker places in their company"
  ON worker_places FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = worker_places.worker_id 
      AND users.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Managers can manage worker places"
  ON worker_places FOR ALL
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = worker_places.worker_id 
      AND users.company_id = get_user_company_id()
    )
  );

-- Schedules policies
CREATE POLICY "Workers can view published schedules for their places"
  ON schedules FOR SELECT
  USING (
    status = 'PUBLISHED'
    AND EXISTS (
      SELECT 1 FROM worker_places 
      WHERE worker_places.worker_id = auth.uid() 
      AND worker_places.place_id = schedules.place_id
    )
  );

CREATE POLICY "Managers can view all schedules for their company places"
  ON schedules FOR SELECT
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM places 
      WHERE places.id = schedules.place_id 
      AND places.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Managers can manage schedules"
  ON schedules FOR ALL
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM places 
      WHERE places.id = schedules.place_id 
      AND places.company_id = get_user_company_id()
    )
  );

-- Shifts policies
CREATE POLICY "Workers can view their shifts"
  ON shifts FOR SELECT
  USING (
    worker_id = auth.uid()
    OR (
      is_open = true
      AND EXISTS (
        SELECT 1 FROM worker_places 
        WHERE worker_places.worker_id = auth.uid() 
        AND worker_places.place_id = shifts.place_id
      )
    )
  );

CREATE POLICY "Managers can view all shifts"
  ON shifts FOR SELECT
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM places 
      WHERE places.id = shifts.place_id 
      AND places.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Managers can manage shifts"
  ON shifts FOR ALL
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM places 
      WHERE places.id = shifts.place_id 
      AND places.company_id = get_user_company_id()
    )
  );

-- Availability policies
CREATE POLICY "Workers can view their own availability"
  ON availability FOR SELECT
  USING (worker_id = auth.uid());

CREATE POLICY "Workers can manage their own availability"
  ON availability FOR ALL
  USING (worker_id = auth.uid());

CREATE POLICY "Managers can view availability"
  ON availability FOR SELECT
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = availability.worker_id 
      AND users.company_id = get_user_company_id()
    )
  );

-- Work sessions policies
CREATE POLICY "Workers can view their own sessions"
  ON work_sessions FOR SELECT
  USING (worker_id = auth.uid());

CREATE POLICY "Workers can manage their own sessions"
  ON work_sessions FOR INSERT
  WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Workers can update their own active sessions"
  ON work_sessions FOR UPDATE
  USING (worker_id = auth.uid() AND end_time IS NULL);

CREATE POLICY "Managers can view all sessions"
  ON work_sessions FOR SELECT
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM places 
      WHERE places.id = work_sessions.place_id 
      AND places.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Managers can update sessions"
  ON work_sessions FOR UPDATE
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM places 
      WHERE places.id = work_sessions.place_id 
      AND places.company_id = get_user_company_id()
    )
  );

-- Timesheets policies
CREATE POLICY "Workers can view their own timesheets"
  ON timesheets FOR SELECT
  USING (worker_id = auth.uid());

CREATE POLICY "Managers can manage timesheets"
  ON timesheets FOR ALL
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM places 
      WHERE places.id = timesheets.place_id 
      AND places.company_id = get_user_company_id()
    )
  );

-- Documents policies
CREATE POLICY "Workers can view their own documents"
  ON documents FOR SELECT
  USING (worker_id = auth.uid());

CREATE POLICY "Managers can manage documents"
  ON documents FOR ALL
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = documents.worker_id 
      AND users.company_id = get_user_company_id()
    )
  );

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = notifications.user_id 
      AND users.company_id = get_user_company_id()
    )
  );

-- Coverage templates policies
CREATE POLICY "Users can view coverage templates"
  ON coverage_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM places 
      WHERE places.id = coverage_templates.place_id 
      AND places.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Managers can manage coverage templates"
  ON coverage_templates FOR ALL
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM places 
      WHERE places.id = coverage_templates.place_id 
      AND places.company_id = get_user_company_id()
    )
  );
