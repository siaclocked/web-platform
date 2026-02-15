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

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get worker's hourly rate
    const { data: userData } = await supabase
      .from('users')
      .select('hourly_rate')
      .eq('id', user.id)
      .single();

    const hourlyRate = userData?.hourly_rate || 0;

    // Get current month sessions
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const { data: currentSessions } = await supabase
      .from('work_sessions')
      .select('id, start_time, end_time, place_id, skill_id, places:place_id (name), skills:skill_id (name)')
      .eq('worker_id', user.id)
      .gte('start_time', startOfMonth.toISOString())
      .lte('start_time', endOfMonth.toISOString())
      .order('start_time', { ascending: false });

    // Get previous month sessions
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const { data: prevSessions } = await supabase
      .from('work_sessions')
      .select('id, start_time, end_time')
      .eq('worker_id', user.id)
      .gte('start_time', startOfPrevMonth.toISOString())
      .lte('start_time', endOfPrevMonth.toISOString());

    const calcHours = (sessions: any[]) => {
      let total = 0;
      (sessions || []).forEach(s => {
        if (s.start_time && s.end_time) {
          total += (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / (1000 * 60 * 60);
        }
      });
      return Math.round(total * 100) / 100;
    };

    const currentHours = calcHours(currentSessions || []);
    const prevHours = calcHours(prevSessions || []);

    // Format sessions for display
    const sessions = (currentSessions || []).map(s => ({
      id: s.id,
      start_time: s.start_time,
      end_time: s.end_time,
      place_name: (s.places as any)?.name || 'Unknown',
      skill_name: (s.skills as any)?.name || 'Unknown',
      hours: s.end_time
        ? Math.round(((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / (1000 * 60 * 60)) * 100) / 100
        : null,
    }));

    return NextResponse.json({
      hourly_rate: hourlyRate,
      current_month: {
        label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        hours: currentHours,
        estimated_pay: Math.round(currentHours * hourlyRate * 100) / 100,
      },
      previous_month: {
        label: new Date(now.getFullYear(), now.getMonth() - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        hours: prevHours,
        estimated_pay: Math.round(prevHours * hourlyRate * 100) / 100,
      },
      sessions,
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
