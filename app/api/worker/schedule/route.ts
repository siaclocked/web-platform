import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get worker's places
    const { data: workerPlaces, error: placesError } = await supabase
      .from('worker_places')
      .select('place_id')
      .eq('worker_id', user.id)
      .eq('is_active', true);

    if (placesError || !workerPlaces || workerPlaces.length === 0) {
      return NextResponse.json({ schedules: [] });
    }

    const placeIds = workerPlaces.map(wp => wp.place_id);

    // Get closed schedule templates with solver results for worker's places
    const { data: templates, error: templatesError } = await supabase
      .from('schedule_templates')
      .select(`
        id,
        name,
        place_id,
        start_date,
        end_date,
        status,
        solver_status,
        solver_result,
        solver_processed_at,
        places:place_id (
          id,
          name
        )
      `)
      .in('place_id', placeIds)
      .eq('status', 'closed')
      .eq('solver_status', 'completed')
      .order('start_date', { ascending: false });

    if (templatesError) {
      console.error('Error fetching schedule templates:', templatesError);
      return NextResponse.json(
        { error: 'Failed to fetch schedules' },
        { status: 500 }
      );
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

    // Extract this worker's assignments from solver results
    const schedules = (templates || []).map(template => {
      const result = template.solver_result as any;
      const assignments = (result?.assignments || [])
        .filter((a: any) => a.worker_id === user.id)
        .map((a: any) => {
          // Convert day offset + minutes to actual date/time
          const startDate = new Date(template.start_date + 'T00:00:00');
          const shiftDate = new Date(startDate);
          shiftDate.setDate(shiftDate.getDate() + a.day);

          const startHour = Math.floor(a.start_minutes / 60);
          const startMin = a.start_minutes % 60;
          const endHour = Math.floor(a.end_minutes / 60);
          const endMin = a.end_minutes % 60;

          return {
            date: shiftDate.toISOString().split('T')[0],
            day_name: shiftDate.toLocaleDateString('en-US', { weekday: 'long' }),
            start_time: `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`,
            end_time: `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`,
            skill_id: a.skill_id,
            skill_name: skillMap[a.skill_id] || a.skill_id,
            hours: (a.end_minutes - a.start_minutes) / 60,
          };
        })
        .sort((a: any, b: any) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

      return {
        id: template.id,
        name: template.name,
        place_name: (template.places as any)?.name || 'Unknown Place',
        start_date: template.start_date,
        end_date: template.end_date,
        assignments,
        total_hours: assignments.reduce((sum: number, a: any) => sum + a.hours, 0),
      };
    }).filter(s => s.assignments.length > 0);

    return NextResponse.json({ schedules });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
