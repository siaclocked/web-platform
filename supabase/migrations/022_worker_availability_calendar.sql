-- Worker Availability Calendar
-- Workers set per-day availability independent of any schedule.
-- The solver reads this when generating schedules.

CREATE TABLE IF NOT EXISTS worker_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  -- 'available_all_day', 'available_range', 'unavailable'
  availability_type VARCHAR(30) NOT NULL DEFAULT 'available_all_day'
    CHECK (availability_type IN ('available_all_day', 'available_range', 'unavailable')),
  -- Only used when availability_type = 'available_range'
  start_time TIME DEFAULT NULL,
  end_time TIME DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- One entry per worker per date
  UNIQUE(worker_id, date)
);

-- Enable RLS
ALTER TABLE worker_availability ENABLE ROW LEVEL SECURITY;

-- Workers can view their own availability
CREATE POLICY "Workers can view own availability" ON worker_availability
  FOR SELECT USING (worker_id = auth.uid());

-- Workers can insert their own availability
CREATE POLICY "Workers can insert own availability" ON worker_availability
  FOR INSERT WITH CHECK (worker_id = auth.uid());

-- Workers can update their own availability
CREATE POLICY "Workers can update own availability" ON worker_availability
  FOR UPDATE USING (worker_id = auth.uid());

-- Workers can delete their own availability
CREATE POLICY "Workers can delete own availability" ON worker_availability
  FOR DELETE USING (worker_id = auth.uid());

-- Managers can view availability for workers in their company
CREATE POLICY "Managers can view worker availability" ON worker_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users mgr
      JOIN users w ON w.company_id = mgr.company_id
      WHERE mgr.id = auth.uid()
      AND mgr.role = 'manager'
      AND w.id = worker_availability.worker_id
    )
  );

-- Indexes
CREATE INDEX idx_worker_availability_worker ON worker_availability(worker_id);
CREATE INDEX idx_worker_availability_date ON worker_availability(date);
CREATE INDEX idx_worker_availability_worker_date ON worker_availability(worker_id, date);

-- Updated_at trigger
CREATE TRIGGER update_worker_availability_updated_at
    BEFORE UPDATE ON worker_availability
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
