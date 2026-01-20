-- Add manager_id column to places table
-- This is a separate migration to ensure manager_id is added first

ALTER TABLE places ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;
