-- Add place_id column to users table
-- This is a separate migration to ensure place_id is added for worker assignments

ALTER TABLE users ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES places(id) ON DELETE SET NULL;
