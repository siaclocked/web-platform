-- Create schedule_templates table for manager schedule templates
CREATE TABLE schedule_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create shift_templates table for daily shift configurations within schedule templates
CREATE TABLE shift_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_template_id UUID NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_type VARCHAR(20) NOT NULL CHECK (day_type IN ('work', 'off')),
  shifts JSONB DEFAULT '[]', -- Array of shift objects with startTime, endTime, position, workers
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(schedule_template_id, date)
);

-- Add RLS policies for schedule_templates
ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view their company schedule templates" ON schedule_templates
  FOR SELECT USING (company_id::text = auth.jwt() ->> 'company_id');

CREATE POLICY "Managers can insert their company schedule templates" ON schedule_templates
  FOR INSERT WITH CHECK (company_id::text = auth.jwt() ->> 'company_id');

CREATE POLICY "Managers can update their company schedule templates" ON schedule_templates
  FOR UPDATE USING (company_id::text = auth.jwt() ->> 'company_id');

CREATE POLICY "Managers can delete their company schedule templates" ON schedule_templates
  FOR DELETE USING (company_id::text = auth.jwt() ->> 'company_id');

-- Add RLS policies for shift_templates
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view shift templates for their company" ON shift_templates
  FOR SELECT USING (schedule_template_id IN (
    SELECT id FROM schedule_templates 
    WHERE company_id::text = auth.jwt() ->> 'company_id'
  ));

CREATE POLICY "Managers can insert shift templates for their company" ON shift_templates
  FOR INSERT WITH CHECK (schedule_template_id IN (
    SELECT id FROM schedule_templates 
    WHERE company_id::text = auth.jwt() ->> 'company_id'
  ));

CREATE POLICY "Managers can update shift templates for their company" ON shift_templates
  FOR UPDATE USING (schedule_template_id IN (
    SELECT id FROM schedule_templates 
    WHERE company_id::text = auth.jwt() ->> 'company_id'
  ));

CREATE POLICY "Managers can delete shift templates for their company" ON shift_templates
  FOR DELETE USING (schedule_template_id IN (
    SELECT id FROM schedule_templates 
    WHERE company_id::text = auth.jwt() ->> 'company_id'
  ));

-- Create indexes for better performance
CREATE INDEX idx_schedule_templates_company_manager ON schedule_templates(company_id, manager_id);
CREATE INDEX idx_schedule_templates_dates ON schedule_templates(start_date, end_date);
CREATE INDEX idx_shift_templates_schedule ON shift_templates(schedule_template_id);
CREATE INDEX idx_shift_templates_date ON shift_templates(date);

-- Add updated_at trigger for schedule_templates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_schedule_templates_updated_at 
    BEFORE UPDATE ON schedule_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for shift_templates
CREATE TRIGGER update_shift_templates_updated_at 
    BEFORE UPDATE ON shift_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
