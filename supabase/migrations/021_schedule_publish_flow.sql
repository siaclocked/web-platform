-- ============================================
-- Migration 021: Schedule Publish Flow
-- ============================================
-- Adds 'schedule_published' status to schedule_templates
-- and creates a proper schedule_publish_history table
-- for immutable snapshots of published schedules.

-- 1. Allow 'schedule_published' as a valid status on schedule_templates
--    Current statuses: draft, published (for availability), closed (solver ran)
--    New: schedule_published (final schedule visible to workers)
ALTER TABLE schedule_templates
  DROP CONSTRAINT IF EXISTS schedule_templates_status_check;

ALTER TABLE schedule_templates
  ADD CONSTRAINT schedule_templates_status_check
  CHECK (status IN ('draft', 'published', 'closed', 'schedule_published'));

-- 2. Add published_at timestamp for schedule publish
ALTER TABLE schedule_templates
  ADD COLUMN IF NOT EXISTS schedule_published_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Create schedule_publish_history table (immutable snapshots)
CREATE TABLE IF NOT EXISTS schedule_publish_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_template_id UUID NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  published_by UUID NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1
);

-- 4. RLS
ALTER TABLE schedule_publish_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view publish history"
  ON schedule_publish_history FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM schedule_templates st
      JOIN users u ON u.id = st.manager_id
      WHERE st.id = schedule_publish_history.schedule_template_id
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "Managers can insert publish history"
  ON schedule_publish_history FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM schedule_templates st
      JOIN users u ON u.id = st.manager_id
      WHERE st.id = schedule_publish_history.schedule_template_id
      AND u.id = auth.uid()
    )
  );

-- 5. Workers can view publish history for their places
CREATE POLICY "Workers can view publish history for their places"
  ON schedule_publish_history FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM schedule_templates st
      JOIN worker_places wp ON wp.place_id = st.place_id AND wp.is_active = true
      WHERE st.id = schedule_publish_history.schedule_template_id
      AND wp.worker_id = auth.uid()
    )
  );

-- 6. Index
CREATE INDEX IF NOT EXISTS idx_schedule_publish_history_template
  ON schedule_publish_history(schedule_template_id);
