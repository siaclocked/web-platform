-- Add place_id and availability_deadline to schedule_templates table
ALTER TABLE schedule_templates 
ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES places(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS availability_deadline TIMESTAMPTZ;

-- Set default values for existing rows if needed
UPDATE schedule_templates 
SET place_id = (SELECT id FROM places LIMIT 1), 
    availability_deadline = NOW() + INTERVAL '7 days'
WHERE place_id IS NULL OR availability_deadline IS NULL;

-- Make the columns NOT NULL after setting defaults
ALTER TABLE schedule_templates 
ALTER COLUMN place_id SET NOT NULL,
ALTER COLUMN availability_deadline SET NOT NULL;

-- Update unique constraint to include place_id
ALTER TABLE schedule_templates 
DROP CONSTRAINT IF EXISTS schedule_templates_company_id_manager_id_name_key;

ALTER TABLE schedule_templates 
ADD CONSTRAINT schedule_templates_company_manager_place_name_unique 
UNIQUE(company_id, manager_id, place_id, name);

-- Drop existing worker policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Workers can view schedule templates for their place" ON schedule_templates;
DROP POLICY IF EXISTS "Workers can view shift templates for their place" ON shift_templates;

-- Add policy for workers to view schedule templates for their place
CREATE POLICY "Workers can view schedule templates for their place" ON schedule_templates
  FOR SELECT USING (place_id::text = auth.jwt() ->> 'place_id');

-- Add policy for workers to view shift templates for their place
CREATE POLICY "Workers can view shift templates for their place" ON shift_templates
  FOR SELECT USING (schedule_template_id IN (
    SELECT id FROM schedule_templates 
    WHERE place_id::text = auth.jwt() ->> 'place_id'
  ));

-- Add indexes for place_id and deadline for better performance
CREATE INDEX IF NOT EXISTS idx_schedule_templates_place ON schedule_templates(place_id);
CREATE INDEX IF NOT EXISTS idx_schedule_templates_deadline ON schedule_templates(availability_deadline);
