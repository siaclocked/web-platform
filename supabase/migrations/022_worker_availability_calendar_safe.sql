-- Worker Availability Calendar (Safe version)

-- Drop indexes first (they exist)
DROP INDEX IF EXISTS idx_worker_availability_worker_date;
DROP INDEX IF EXISTS idx_worker_availability_date;
DROP INDEX IF EXISTS idx_worker_availability_worker;

-- Create table (doesn't exist yet)
CREATE TABLE worker_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  availability_type VARCHAR(30) NOT NULL DEFAULT 'available_all_day'
    CHECK (availability_type IN ('available_all_day', 'available_range', 'unavailable')),
  start_time TIME DEFAULT NULL,
  end_time TIME DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, date)
);

-- Enable RLS
ALTER TABLE worker_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workers can view own availability" ON worker_availability
  FOR SELECT USING (worker_id = auth.uid());

CREATE POLICY "Workers can insert own availability" ON worker_availability
  FOR INSERT WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Workers can update own availability" ON worker_availability
  FOR UPDATE USING (worker_id = auth.uid());

CREATE POLICY "Workers can delete own availability" ON worker_availability
  FOR DELETE USING (worker_id = auth.uid());

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
