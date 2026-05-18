import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
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

export async function GET(request: Request) {
  try {
    const supabase = getSupabase();
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get('place_id');

    // Get manager's places
    const { data: managerPlaces } = await supabase
      .from('places')
      .select('id')
      .eq('manager_id', user.id)
      .eq('company_id', userData.company_id);

    const placeIds = (managerPlaces || []).map(p => p.id);
    if (placeIds.length === 0) {
      return NextResponse.json({ templates: [] });
    }

    let query = supabase
      .from('coverage_templates')
      .select(`
        id,
        place_id,
        skill_id,
        day_of_week,
        start_time,
        end_time,
        min_workers,
        max_workers,
        created_at,
        updated_at
      `)
      .in('place_id', placeIds)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (placeId) {
      query = query.eq('place_id', placeId);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('Error fetching coverage templates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: templates || [] });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { place_id, skill_id, day_of_week, start_time, end_time, min_workers, max_workers } = body;

    // Validate required fields
    if (!place_id || !skill_id || day_of_week === undefined || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'place_id, skill_id, day_of_week, start_time, and end_time are required' },
        { status: 400 }
      );
    }

    if (day_of_week < 0 || day_of_week > 6) {
      return NextResponse.json({ error: 'day_of_week must be 0-6' }, { status: 400 });
    }

    if (start_time >= end_time) {
      return NextResponse.json({ error: 'start_time must be before end_time' }, { status: 400 });
    }

    // Verify manager owns this place
    const { data: place } = await supabase
      .from('places')
      .select('id')
      .eq('id', place_id)
      .eq('manager_id', user.id)
      .single();

    if (!place) {
      return NextResponse.json({ error: 'Place not found or access denied' }, { status: 404 });
    }

    // Check for overlapping windows on the same day/place/skill
    const { data: existing } = await supabase
      .from('coverage_templates')
      .select('id, start_time, end_time')
      .eq('place_id', place_id)
      .eq('skill_id', skill_id)
      .eq('day_of_week', day_of_week);

    const hasOverlap = (existing || []).some(e => {
      return start_time < e.end_time && end_time > e.start_time;
    });

    if (hasOverlap) {
      return NextResponse.json(
        { error: 'This window overlaps with an existing coverage template for the same skill and day' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('coverage_templates')
      .insert({
        place_id,
        skill_id,
        day_of_week,
        start_time,
        end_time,
        min_workers: min_workers || 1,
        max_workers: max_workers || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating coverage template:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, template: data });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = getSupabase();
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { id, place_id, skill_id, day_of_week, start_time, end_time, min_workers, max_workers } = body;

    if (!id) {
      return NextResponse.json({ error: 'Template id is required' }, { status: 400 });
    }

    if (start_time && end_time && start_time >= end_time) {
      return NextResponse.json({ error: 'start_time must be before end_time' }, { status: 400 });
    }

    // Verify manager owns the place this template belongs to
    const { data: existing } = await supabase
      .from('coverage_templates')
      .select('place_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const { data: place } = await supabase
      .from('places')
      .select('id')
      .eq('id', existing.place_id)
      .eq('manager_id', user.id)
      .single();

    if (!place) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check for overlaps (excluding self)
    if (start_time && end_time && skill_id !== undefined && day_of_week !== undefined) {
      const { data: others } = await supabase
        .from('coverage_templates')
        .select('id, start_time, end_time')
        .eq('place_id', place_id || existing.place_id)
        .eq('skill_id', skill_id)
        .eq('day_of_week', day_of_week)
        .neq('id', id);

      const hasOverlap = (others || []).some(e => {
        return start_time < e.end_time && end_time > e.start_time;
      });

      if (hasOverlap) {
        return NextResponse.json(
          { error: 'This window overlaps with an existing coverage template' },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (day_of_week !== undefined) updateData.day_of_week = day_of_week;
    if (start_time) updateData.start_time = start_time;
    if (end_time) updateData.end_time = end_time;
    if (min_workers !== undefined) updateData.min_workers = min_workers;
    if (max_workers !== undefined) updateData.max_workers = max_workers;
    if (skill_id) updateData.skill_id = skill_id;

    const { data, error } = await supabase
      .from('coverage_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating coverage template:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, template: data });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = getSupabase();
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Template id is required' }, { status: 400 });
    }

    // Verify manager owns the place
    const { data: template } = await supabase
      .from('coverage_templates')
      .select('place_id')
      .eq('id', id)
      .single();

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const { data: place } = await supabase
      .from('places')
      .select('id')
      .eq('id', template.place_id)
      .eq('manager_id', user.id)
      .single();

    if (!place) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { error } = await supabase
      .from('coverage_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting coverage template:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
