import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function getAuthUser(request: Request) {
  const supabase = getSupabase();
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function verifyManagerOwnsPlace(supabase: ReturnType<typeof getSupabase>, managerId: string, placeId: string) {
  const { data: place } = await supabase
    .from('places')
    .select('id')
    .eq('id', placeId)
    .eq('manager_id', managerId)
    .single();

  return !!place;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: placeId } = await params;
    const ownsPlace = await verifyManagerOwnsPlace(supabase, user.id, placeId);
    if (!ownsPlace) {
      return NextResponse.json({ error: 'Place not found or access denied' }, { status: 404 });
    }

    const { data: manager } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!manager?.company_id) {
      return NextResponse.json({ error: 'Manager company not found' }, { status: 404 });
    }

    const { data: skills, error: skillsError } = await supabase
      .from('skills')
      .select('id, name')
      .eq('company_id', manager.company_id)
      .order('name', { ascending: true });

    if (skillsError) {
      return NextResponse.json({ error: skillsError.message }, { status: 500 });
    }

    const { data: configs, error: configError } = await supabase
      .from('place_skill_configs')
      .select('skill_id, enforce_min_team_rating, min_avg_rating')
      .eq('place_id', placeId);

    if (configError) {
      return NextResponse.json({ error: configError.message }, { status: 500 });
    }

    type PlaceSkillConfigRow = {
      skill_id: string;
      enforce_min_team_rating: boolean;
      min_avg_rating: number | null;
    };
    const configBySkill = new Map<string, PlaceSkillConfigRow>(
      (configs || []).map((c: PlaceSkillConfigRow) => [c.skill_id, c])
    );
    const merged = (skills || []).map((skill) => {
      const existing = configBySkill.get(skill.id);
      return {
        skill_id: skill.id,
        skill_name: skill.name,
        enforce_min_team_rating: existing?.enforce_min_team_rating ?? false,
        min_avg_rating: existing?.min_avg_rating ?? null,
      };
    });

    return NextResponse.json({ skill_configs: merged });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: placeId } = await params;
    const ownsPlace = await verifyManagerOwnsPlace(supabase, user.id, placeId);
    if (!ownsPlace) {
      return NextResponse.json({ error: 'Place not found or access denied' }, { status: 404 });
    }

    const body = await request.json();
    const skillConfigs = Array.isArray(body.skill_configs) ? body.skill_configs : [];

    const { data: manager } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!manager?.company_id) {
      return NextResponse.json({ error: 'Manager company not found' }, { status: 404 });
    }

    const { data: skills, error: skillsError } = await supabase
      .from('skills')
      .select('id')
      .eq('company_id', manager.company_id);

    if (skillsError) {
      return NextResponse.json({ error: skillsError.message }, { status: 500 });
    }

    const allowedSkillIds = new Set((skills || []).map((s) => s.id));
    const rowsToUpsert: Array<{
      place_id: string;
      skill_id: string;
      enforce_min_team_rating: boolean;
      min_avg_rating: number | null;
    }> = [];

    for (const cfg of skillConfigs) {
      if (!cfg?.skill_id || !allowedSkillIds.has(cfg.skill_id)) {
        continue;
      }

      const enforce = Boolean(cfg.enforce_min_team_rating);
      const minAvgRaw = cfg.min_avg_rating;
      const minAvg = minAvgRaw === null || minAvgRaw === undefined || minAvgRaw === ''
        ? null
        : Number(minAvgRaw);

      if (enforce && (minAvg === null || Number.isNaN(minAvg) || minAvg <= 0)) {
        return NextResponse.json(
          { error: `min_avg_rating must be > 0 when enforcement is enabled for skill ${cfg.skill_id}` },
          { status: 400 }
        );
      }

      rowsToUpsert.push({
        place_id: placeId,
        skill_id: cfg.skill_id,
        enforce_min_team_rating: enforce,
        min_avg_rating: enforce ? minAvg : null,
      });
    }

    if (rowsToUpsert.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const { error: upsertError } = await supabase
      .from('place_skill_configs')
      .upsert(rowsToUpsert, { onConflict: 'place_id,skill_id' });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: rowsToUpsert.length });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
