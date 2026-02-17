-- ============================================
-- Migration 020: Add max_workers to coverage_templates
-- ============================================
-- The dev plan requires minCount + maxCount per coverage window.
-- The existing table only has min_workers.

ALTER TABLE coverage_templates
ADD COLUMN IF NOT EXISTS max_workers INTEGER DEFAULT NULL;

-- Add index for efficient lookups by place + skill + day
CREATE INDEX IF NOT EXISTS idx_coverage_templates_place_skill_day
  ON coverage_templates(place_id, skill_id, day_of_week);
