-- Worker Availability Submissions Table
-- Stores which shifts workers have marked themselves as available for within a timesheet

CREATE TABLE IF NOT EXISTS worker_availability_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_template_id UUID NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_template_id UUID NOT NULL REFERENCES shift_templates(id) ON DELETE CASCADE,
  shift_index INTEGER NOT NULL, -- Index of the specific shift within the shift_template.shifts array
  is_available BOOLEAN DEFAULT true,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(schedule_template_id, worker_id, shift_template_id, shift_index)
);

-- Add status tracking for solver processing
ALTER TABLE schedule_templates 
ADD COLUMN IF NOT EXISTS solver_status VARCHAR(50) DEFAULT NULL 
  CHECK (solver_status IN (NULL, 'pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS solver_result JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS solver_processed_at TIMESTAMPTZ DEFAULT NULL;

-- Enable RLS
ALTER TABLE worker_availability_submissions ENABLE ROW LEVEL SECURITY;

-- Workers can view their own submissions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'worker_availability_submissions' 
    AND policyname = 'Workers can view their own availability submissions'
  ) THEN
    CREATE POLICY "Workers can view their own availability submissions" ON worker_availability_submissions
      FOR SELECT USING (worker_id = auth.uid());
  END IF;
END $$;

-- Workers can insert their own submissions (only for published timesheets before deadline)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'worker_availability_submissions' 
    AND policyname = 'Workers can insert their own availability submissions'
  ) THEN
    CREATE POLICY "Workers can insert their own availability submissions" ON worker_availability_submissions
      FOR INSERT WITH CHECK (
        worker_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM schedule_templates st
          WHERE st.id = schedule_template_id
          AND st.status = 'published'
          AND st.availability_deadline > NOW()
        )
      );
  END IF;
END $$;

-- Workers can update their own submissions (only before deadline)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'worker_availability_submissions' 
    AND policyname = 'Workers can update their own availability submissions'
  ) THEN
    CREATE POLICY "Workers can update their own availability submissions" ON worker_availability_submissions
      FOR UPDATE USING (
        worker_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM schedule_templates st
          WHERE st.id = schedule_template_id
          AND st.status = 'published'
          AND st.availability_deadline > NOW()
        )
      );
  END IF;
END $$;

-- Workers can delete their own submissions (only before deadline)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'worker_availability_submissions' 
    AND policyname = 'Workers can delete their own availability submissions'
  ) THEN
    CREATE POLICY "Workers can delete their own availability submissions" ON worker_availability_submissions
      FOR DELETE USING (
        worker_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM schedule_templates st
          WHERE st.id = schedule_template_id
          AND st.status = 'published'
          AND st.availability_deadline > NOW()
        )
      );
  END IF;
END $$;

-- Managers can view all submissions for their company's timesheets
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'worker_availability_submissions' 
    AND policyname = 'Managers can view availability submissions for their timesheets'
  ) THEN
    CREATE POLICY "Managers can view availability submissions for their timesheets" ON worker_availability_submissions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM schedule_templates st
          JOIN users u ON u.id = st.manager_id
          WHERE st.id = schedule_template_id
          AND u.id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create indexes for performance (with IF NOT EXISTS checks)
CREATE INDEX IF NOT EXISTS idx_worker_availability_schedule ON worker_availability_submissions(schedule_template_id);
CREATE INDEX IF NOT EXISTS idx_worker_availability_worker ON worker_availability_submissions(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_availability_shift ON worker_availability_submissions(shift_template_id);
CREATE INDEX IF NOT EXISTS idx_schedule_templates_solver_status ON schedule_templates(solver_status);

-- Add updated_at trigger
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_worker_availability_submissions_updated_at'
  ) THEN
    CREATE TRIGGER update_worker_availability_submissions_updated_at 
        BEFORE UPDATE ON worker_availability_submissions 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
