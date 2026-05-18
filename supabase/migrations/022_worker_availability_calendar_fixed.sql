-- Worker Availability Calendar (Fixed - handles existing objects)

-- Drop existing objects if they exist (table-conditional to avoid errors on fresh DB)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'worker_availability') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_worker_availability_updated_at ON worker_availability';
  END IF;
END $$;
DROP INDEX IF EXISTS idx_worker_availability_worker_date;
DROP INDEX IF EXISTS idx_worker_availability_date;
DROP INDEX IF EXISTS idx_worker_availability_worker;
DROP TABLE IF EXISTS worker_availability CASCADE;

-- Create table
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
