-- Add positions table
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, manager_id, name)
);

-- Add manager_id to users table to track which manager added each worker
ALTER TABLE users 
ADD COLUMN manager_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add position_id to users table
ALTER TABLE users 
ADD COLUMN position_id UUID REFERENCES positions(id) ON DELETE SET NULL;

-- Create shift_timeframes table for manager-defined timeframes
CREATE TABLE shift_timeframes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create shift_slots table for individual shifts within timeframes
CREATE TABLE shift_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timeframe_id UUID NOT NULL REFERENCES shift_timeframes(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_workers INTEGER NOT NULL DEFAULT 1,
  current_workers INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'full', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create worker_shift_assignments table for worker shift selections
CREATE TABLE worker_shift_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_slot_id UUID NOT NULL REFERENCES shift_slots(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'cancelled', 'completed')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_slot_id, worker_id)
);

-- Add RLS policies for positions
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view their company positions" ON positions
  FOR SELECT USING (company_id = auth.jwt() ->> 'company_id');

CREATE POLICY "Managers can insert their company positions" ON positions
  FOR INSERT WITH CHECK (company_id = auth.jwt() ->> 'company_id');

CREATE POLICY "Managers can update their company positions" ON positions
  FOR UPDATE USING (company_id = auth.jwt() ->> 'company_id');

CREATE POLICY "Managers can delete their company positions" ON positions
  FOR DELETE USING (company_id = auth.jwt() ->> 'company_id');

-- Add RLS policies for shift_timeframes
ALTER TABLE shift_timeframes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view their company timeframes" ON shift_timeframes
  FOR SELECT USING (company_id = auth.jwt() ->> 'company_id');

CREATE POLICY "Managers can insert their company timeframes" ON shift_timeframes
  FOR INSERT WITH CHECK (company_id = auth.jwt() ->> 'company_id');

CREATE POLICY "Managers can update their company timeframes" ON shift_timeframes
  FOR UPDATE USING (company_id = auth.jwt() ->> 'company_id');

CREATE POLICY "Managers can delete their company timeframes" ON shift_timeframes
  FOR DELETE USING (company_id = auth.jwt() ->> 'company_id');

-- Add RLS policies for shift_slots
ALTER TABLE shift_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view their company shift slots" ON shift_slots
  FOR SELECT USING (timeframe_id IN (
    SELECT id FROM shift_timeframes 
    WHERE company_id = auth.jwt() ->> 'company_id'
  ));

CREATE POLICY "Managers can insert their company shift slots" ON shift_slots
  FOR INSERT WITH CHECK (timeframe_id IN (
    SELECT id FROM shift_timeframes 
    WHERE company_id = auth.jwt() ->> 'company_id'
  ));

CREATE POLICY "Managers can update their company shift slots" ON shift_slots
  FOR UPDATE USING (timeframe_id IN (
    SELECT id FROM shift_timeframes 
    WHERE company_id = auth.jwt() ->> 'company_id'
  ));

CREATE POLICY "Managers can delete their company shift slots" ON shift_slots
  FOR DELETE USING (timeframe_id IN (
    SELECT id FROM shift_timeframes 
    WHERE company_id = auth.jwt() ->> 'company_id'
  ));

-- Add RLS policies for worker_shift_assignments
ALTER TABLE worker_shift_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workers can view their assignments" ON worker_shift_assignments
  FOR SELECT USING (worker_id = auth.uid());

CREATE POLICY "Workers can insert their assignments" ON worker_shift_assignments
  FOR INSERT WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Workers can update their assignments" ON worker_shift_assignments
  FOR UPDATE USING (worker_id = auth.uid());

CREATE POLICY "Workers can delete their assignments" ON worker_shift_assignments
  FOR DELETE USING (worker_id = auth.uid());

CREATE POLICY "Managers can view assignments for their company" ON worker_shift_assignments
  FOR SELECT USING (shift_slot_id IN (
    SELECT ss.id FROM shift_slots ss
    JOIN shift_timeframes st ON ss.timeframe_id = st.id
    WHERE st.company_id = auth.jwt() ->> 'company_id'
  ));

-- Create indexes for better performance
CREATE INDEX idx_positions_company_manager ON positions(company_id, manager_id);
CREATE INDEX idx_shift_timeframes_company ON shift_timeframes(company_id, manager_id);
CREATE INDEX idx_shift_slots_timeframe ON shift_slots(timeframe_id);
CREATE INDEX idx_shift_slots_date ON shift_slots(date);
CREATE INDEX idx_worker_assignments_worker ON worker_shift_assignments(worker_id);
CREATE INDEX idx_worker_assignments_shift ON worker_shift_assignments(shift_slot_id);

-- Update existing users to have manager_id for workers (optional - for existing data)
-- This would need to be run manually based on your existing data structure
