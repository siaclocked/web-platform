-- Add missing columns to places table if they don't exist
-- This migration fixes the schema mismatch issue

-- Add manager_id column if it doesn't exist
ALTER TABLE places ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add company_id column if it doesn't exist
ALTER TABLE places ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Add created_at column if it doesn't exist
ALTER TABLE places ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add updated_at column if it doesn't exist
ALTER TABLE places ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add place_id to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES places(id) ON DELETE SET NULL;

-- Create missing indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_places_company_manager ON places(company_id, manager_id);
CREATE INDEX IF NOT EXISTS idx_places_company ON places(company_id);
CREATE INDEX IF NOT EXISTS idx_users_place_id ON users(place_id);

-- Add updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger (drop first for idempotency)
DROP TRIGGER IF EXISTS update_places_updated_at ON places;
CREATE TRIGGER update_places_updated_at
  BEFORE UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();