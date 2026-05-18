import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workerId: string }> }
) {
  try {
    const { workerId } = await params;
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
    const { data: managerData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!managerData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify worker belongs to same company
    const { data: workerData } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, hourly_rate')
      .eq('id', workerId)
      .eq('company_id', managerData.company_id)
      .single();

    if (!workerData) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    // Get worker's places
    const { data: workerPlaces } = await supabase
      .from('worker_places')
      .select('place_id, places:place_id (id, name)')
      .eq('worker_id', workerId)
      .eq('is_active', true);

    const places = (workerPlaces || []).map((wp: any) => ({
      id: wp.places?.id || wp.place_id,
      name: wp.places?.name || 'Unknown',
    }));

    // Get all completed sessions for this worker, grouped by place
    const { data: sessions } = await supabase
      .from('work_sessions')
      .select(`
        id,
        place_id,
        start_time,
        end_time,
        is_scheduled,
        places (name)
      `)
      .eq('worker_id', workerId)
      .not('end_time', 'is', null)
      .order('start_time', { ascending: false });

    // Calculate hours per place
    const placeHours: Record<string, { place_name: string; total_hours: number; sessions: any[] }> = {};
    (sessions || []).forEach((s: any) => {
      const placeId = s.place_id;
      if (!placeHours[placeId]) {
        placeHours[placeId] = {
          place_name: s.places?.name || 'Unknown',
          total_hours: 0,
          sessions: [],
        };
      }
      const hours = (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / (1000 * 60 * 60);
      placeHours[placeId].total_hours += hours;
      placeHours[placeId].sessions.push({
        id: s.id,
        start_time: s.start_time,
        end_time: s.end_time,
        hours: parseFloat(hours.toFixed(2)),
        is_scheduled: s.is_scheduled,
      });
    });

    // Calculate estimated wages per place
    const hourlyRate = workerData.hourly_rate || 0;
    const placeSummaries = Object.entries(placeHours).map(([placeId, data]) => ({
      place_id: placeId,
      place_name: data.place_name,
      total_hours: parseFloat(data.total_hours.toFixed(2)),
      estimated_wage: parseFloat((data.total_hours * hourlyRate).toFixed(2)),
      session_count: data.sessions.length,
      sessions: data.sessions.slice(0, 20), // limit to 20 most recent per place
    }));

    return NextResponse.json({
      worker: workerData,
      places,
      hourly_rate: hourlyRate,
      place_summaries: placeSummaries,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
