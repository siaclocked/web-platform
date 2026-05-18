import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabase();

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get manager's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all workers in this company
    const { data: workers } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, hourly_rate')
      .eq('company_id', userData.company_id)
      .eq('role', 'worker')
      .eq('is_active', true);

    const workerIds = (workers || []).map(w => w.id);

    if (workerIds.length === 0) {
      return NextResponse.json({ activeSessions: [], workers: [] });
    }

    // Get active sessions (no end_time)
    const { data: activeSessions } = await supabase
      .from('work_sessions')
      .select(`
        id,
        worker_id,
        place_id,
        skill_id,
        start_time,
        is_scheduled,
        places (name),
        skills (name)
      `)
      .in('worker_id', workerIds)
      .is('end_time', null);

    // Get worker places for context
    const { data: workerPlaces } = await supabase
      .from('worker_places')
      .select('worker_id, place_id, places:place_id (id, name)')
      .in('worker_id', workerIds)
      .eq('is_active', true);

    // Build worker places map
    const workerPlacesMap: Record<string, Array<{ id: string; name: string }>> = {};
    (workerPlaces || []).forEach((wp: any) => {
      if (!workerPlacesMap[wp.worker_id]) workerPlacesMap[wp.worker_id] = [];
      if (wp.places) {
        workerPlacesMap[wp.worker_id].push({ id: wp.places.id, name: wp.places.name });
      }
    });

    // Enrich workers with places
    const enrichedWorkers = (workers || []).map(w => ({
      ...w,
      places: workerPlacesMap[w.id] || [],
    }));

    // Enrich active sessions with worker name
    const workerMap = (workers || []).reduce((acc: any, w: any) => {
      acc[w.id] = w;
      return acc;
    }, {});

    const enrichedSessions = (activeSessions || []).map((s: any) => ({
      ...s,
      worker_name: workerMap[s.worker_id]
        ? `${workerMap[s.worker_id].first_name} ${workerMap[s.worker_id].last_name}`
        : 'Unknown',
    }));

    return NextResponse.json({
      activeSessions: enrichedSessions,
      workers: enrichedWorkers,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
