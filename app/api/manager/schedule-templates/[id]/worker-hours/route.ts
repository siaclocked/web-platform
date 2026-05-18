import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scheduleId } = await params;
    const supabase = getServiceSupabase();

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get schedule template with solver result
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedule_templates')
      .select('id, place_id, solver_result, start_date, end_date')
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const solverResult = schedule.solver_result as any;
    if (!solverResult?.assignments) {
      return NextResponse.json({ workers: [] });
    }

    // Get unique worker IDs from assignments
    const workerIds = [...new Set((solverResult.assignments as any[]).map((a: any) => a.worker_id))];
    if (workerIds.length === 0) {
      return NextResponse.json({ workers: [] });
    }

    // Fetch worker details with hour targets
    const { data: workers, error: workersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, monthly_min_hours, monthly_optimal_hours, hourly_rate, can_open, can_close')
      .in('id', workerIds);

    if (workersError) {
      console.error('Error fetching workers:', workersError);
      return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 });
    }

    // Fetch worker skills (positions) for each worker
    const { data: workerSkills } = await supabase
      .from('worker_skills')
      .select('worker_id, skill_id, rating, skills:skill_id (id, name, color)')
      .in('worker_id', workerIds);

    // Build skills map
    const skillsMap: Record<string, Array<{ id: string; name: string; color: string; rating: number }>> = {};
    (workerSkills || []).forEach((ws: any) => {
      const s = ws.skills;
      const skillData = {
        id: ws.skill_id,
        name: Array.isArray(s) ? s[0]?.name : s?.name,
        color: Array.isArray(s) ? s[0]?.color : s?.color,
        rating: ws.rating || 5,
      };
      if (!skillsMap[ws.worker_id]) skillsMap[ws.worker_id] = [];
      skillsMap[ws.worker_id].push(skillData);
    });

    // Calculate actual hours from solver assignments
    const actualHours: Record<string, number> = {};
    (solverResult.assignments as any[]).forEach((a: any) => {
      const hours = (a.end_minutes - a.start_minutes) / 60;
      actualHours[a.worker_id] = (actualHours[a.worker_id] || 0) + hours;
    });

    // Build response
    const workerHours = (workers || []).map((w: any) => ({
      id: w.id,
      name: `${w.first_name || ''} ${w.last_name || ''}`.trim(),
      monthly_min_hours: w.monthly_min_hours,
      monthly_optimal_hours: w.monthly_optimal_hours,
      hourly_rate: w.hourly_rate,
      can_open: w.can_open,
      can_close: w.can_close,
      actual_hours: Math.round((actualHours[w.id] || 0) * 10) / 10,
      skills: skillsMap[w.id] || [],
    }));

    // Sort by actual hours descending
    workerHours.sort((a: any, b: any) => b.actual_hours - a.actual_hours);

    return NextResponse.json({ workers: workerHours });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
