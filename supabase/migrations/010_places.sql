-- Add manager_id to users table (if it doesn't exist) - MUST BE FIRST
-- This will fail if column already exists, but that's okay
-- Note: If this fails, it means manager_id already exists, which is what we want
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add places table for work locations (if it doesn't exist) - AFTER manager_id exists
-- This should work since manager_id should exist now (either from above or already there)
CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, manager_id, name)
);

-- Add place_id to users table (if it doesn't exist)
ALTER TABLE users ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES places(id) ON DELETE SET NULL;

-- Ensure places.manager_id exists (in case places came from 001_initial_schema without it)
ALTER TABLE places ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for faster queries (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_places_company_manager ON places(company_id, manager_id);
CREATE INDEX IF NOT EXISTS idx_places_company ON places(company_id);
CREATE INDEX IF NOT EXISTS idx_users_place_id ON users(place_id);

-- Add RLS policies for places (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'places' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE places ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Policy: Managers can see their own places (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'places' 
    AND policyname = 'Managers can view their own places'
  ) THEN
    CREATE POLICY "Managers can view their own places" ON places
      FOR SELECT USING (
        auth.uid() = manager_id
      );
  END IF;
END $$;

-- Policy: Managers can insert their own places (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'places' 
    AND policyname = 'Managers can insert their own places'
  ) THEN
    CREATE POLICY "Managers can insert their own places" ON places
      FOR INSERT WITH CHECK (
        auth.uid() = manager_id
      );
  END IF;
END $$;

-- Policy: Managers can update their own places (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'places' 
    AND policyname = 'Managers can update their own places'
  ) THEN
    CREATE POLICY "Managers can update their own places" ON places
      FOR UPDATE USING (
        auth.uid() = manager_id
      );
  END IF;
END $$;

-- Policy: Managers can delete their own places (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'places' 
    AND policyname = 'Managers can delete their own places'
  ) THEN
    CREATE POLICY "Managers can delete their own places" ON places
      FOR DELETE USING (
        auth.uid() = manager_id
      );
  END IF;
END $$;

-- Policy: Company users can view all places in their company (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'places' 
    AND policyname = 'Company users can view all company places'
  ) THEN
    CREATE POLICY "Company users can view all company places" ON places
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() 
          AND users.company_id = places.company_id 
          AND users.role = 'company'
        )
      );
  END IF;
END $$;

-- Add updated_at trigger (function is safe to replace)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_places_updated_at'
  ) THEN
    CREATE TRIGGER update_places_updated_at 
      BEFORE UPDATE ON places 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
