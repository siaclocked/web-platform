-- Add vacation availability type and paid leave support
-- 1. Add 'vacation' to worker_availability.availability_type
-- 2. Add is_paid_leave flag
-- 3. Create paid_leave table for manager-assigned paid leave intervals

-- Add vacation type and is_paid_leave flag to worker_availability
ALTER TABLE worker_availability
  DROP CONSTRAINT IF EXISTS worker_availability_availability_type_check;

ALTER TABLE worker_availability
  ADD CONSTRAINT worker_availability_availability_type_check
  CHECK (availability_type IN ('available_all_day', 'available_range', 'unavailable', 'vacation'));

ALTER TABLE worker_availability
  ADD COLUMN IF NOT EXISTS is_paid_leave BOOLEAN DEFAULT FALSE;

-- Paid leave table: Manager assigns paid leave intervals to workers
CREATE TABLE IF NOT EXISTS paid_leave (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  granted_by UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

-- Enable RLS
ALTER TABLE paid_leave ENABLE ROW LEVEL SECURITY;

-- Managers can view paid leave for workers in their company
CREATE POLICY "Managers can view paid leave" ON paid_leave
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users mgr
      WHERE mgr.id = auth.uid()
      AND mgr.role = 'manager'
      AND mgr.company_id = paid_leave.company_id
    )
  );

-- Managers can insert paid leave for workers in their company
CREATE POLICY "Managers can insert paid leave" ON paid_leave
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users mgr
      WHERE mgr.id = auth.uid()
      AND mgr.role = 'manager'
      AND mgr.company_id = paid_leave.company_id
    )
  );

-- Managers can delete paid leave
CREATE POLICY "Managers can delete paid leave" ON paid_leave
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users mgr
      WHERE mgr.id = auth.uid()
      AND mgr.role = 'manager'
      AND mgr.company_id = paid_leave.company_id
    )
  );

-- Workers can view their own paid leave
CREATE POLICY "Workers can view own paid leave" ON paid_leave
  FOR SELECT USING (worker_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_paid_leave_worker ON paid_leave(worker_id);
CREATE INDEX IF NOT EXISTS idx_paid_leave_company ON paid_leave(company_id);
CREATE INDEX IF NOT EXISTS idx_paid_leave_dates ON paid_leave(start_date, end_date);
