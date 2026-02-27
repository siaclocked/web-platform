-- ============================================
-- Migration 027: Place skill constraints + worker open/close flags
-- ============================================

-- 1) Worker day-edge eligibility flags
ALTER TABLE users
ADD COLUMN IF NOT EXISTS can_open BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS can_close BOOLEAN NOT NULL DEFAULT true;

-- 2) Place + skill configuration for team rating constraints
CREATE TABLE IF NOT EXISTS place_skill_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  enforce_min_team_rating BOOLEAN NOT NULL DEFAULT false,
  min_avg_rating NUMERIC(4,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(place_id, skill_id),
  CONSTRAINT place_skill_configs_min_avg_check
    CHECK (
      (enforce_min_team_rating = false AND min_avg_rating IS NULL)
      OR (enforce_min_team_rating = true AND min_avg_rating IS NOT NULL AND min_avg_rating > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_place_skill_configs_place_skill
  ON place_skill_configs(place_id, skill_id);

-- 3) RLS
ALTER TABLE place_skill_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view place skill configs" ON place_skill_configs;
CREATE POLICY "Users can view place skill configs"
  ON place_skill_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM places
      WHERE places.id = place_skill_configs.place_id
      AND places.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Managers can manage place skill configs" ON place_skill_configs;
CREATE POLICY "Managers can manage place skill configs"
  ON place_skill_configs FOR ALL
  USING (
    get_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM places
      WHERE places.id = place_skill_configs.place_id
      AND places.company_id = get_user_company_id()
    )
  );

-- 4) updated_at trigger
DROP TRIGGER IF EXISTS update_place_skill_configs_updated_at ON place_skill_configs;
CREATE TRIGGER update_place_skill_configs_updated_at
  BEFORE UPDATE ON place_skill_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
