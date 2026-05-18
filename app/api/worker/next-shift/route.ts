import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get worker's places
    const { data: workerPlaces } = await supabase
      .from('worker_places')
      .select('place_id')
      .eq('worker_id', user.id)
      .eq('is_active', true);

    if (!workerPlaces || workerPlaces.length === 0) {
      return NextResponse.json({ next_shift: null });
    }

    const placeIds = workerPlaces.map(wp => wp.place_id);

    // Get published/closed schedule templates with solver results for worker's places
    const { data: templates } = await supabase
      .from('schedule_templates')
      .select(`
        id, name, place_id, start_date, end_date, solver_result,
        places:place_id ( id, name )
      `)
      .in('place_id', placeIds)
      .in('status', ['closed', 'schedule_published'])
      .eq('solver_status', 'completed')
      .order('start_date', { ascending: true });

    if (!templates || templates.length === 0) {
      return NextResponse.json({ next_shift: null });
    }

    // Get skills for name lookup
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    const { data: skills } = await supabase
      .from('skills')
      .select('id, name')
      .eq('company_id', userData?.company_id || '');

    const skillMap: Record<string, string> = {};
    (skills || []).forEach(s => { skillMap[s.id] = s.name; });

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    let nextShift: any = null;

    for (const template of templates) {
      const result = template.solver_result as any;
      if (!result?.assignments) continue;

      const myAssignments = result.assignments.filter((a: any) => a.worker_id === user.id);

      for (const a of myAssignments) {
        const startDate = new Date(template.start_date + 'T00:00:00');
        const shiftDate = new Date(startDate);
        shiftDate.setDate(shiftDate.getDate() + a.day);
        const shiftDateStr = shiftDate.toISOString().split('T')[0];

        // Skip past shifts
        if (shiftDateStr < todayStr) continue;
        if (shiftDateStr === todayStr && a.end_minutes <= nowMinutes) continue;

        const startHour = Math.floor(a.start_minutes / 60);
        const startMin = a.start_minutes % 60;
        const endHour = Math.floor(a.end_minutes / 60);
        const endMin = a.end_minutes % 60;

        const candidate = {
          date: shiftDateStr,
          day_name: shiftDate.toLocaleDateString('en-US', { weekday: 'long' }),
          start_time: `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`,
          end_time: `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`,
          skill_name: skillMap[a.skill_id] || a.skill_id,
          place_name: (template.places as any)?.name || 'Unknown',
          schedule_name: template.name,
          hours: (a.end_minutes - a.start_minutes) / 60,
          is_today: shiftDateStr === todayStr,
          is_active: shiftDateStr === todayStr && a.start_minutes <= nowMinutes && a.end_minutes > nowMinutes,
        };

        if (!nextShift || shiftDateStr < nextShift.date ||
            (shiftDateStr === nextShift.date && a.start_minutes < nextShift._start_minutes)) {
          nextShift = { ...candidate, _start_minutes: a.start_minutes };
        }
      }
    }

    // Clean internal field
    if (nextShift) {
      delete nextShift._start_minutes;
    }

    return NextResponse.json({ next_shift: nextShift });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
