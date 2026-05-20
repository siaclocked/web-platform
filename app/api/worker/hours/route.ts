import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
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

    // Fetch ALL sessions (any status) for display, but only count `approved` toward totals
    const { data: currentSessions } = await supabase
      .from('work_sessions')
      .select('id, start_time, end_time, status, place_id, skill_id, places:place_id (name), skills:skill_id (name)')
      .eq('worker_id', user.id)
      .gte('start_time', startOfMonth.toISOString())
      .lte('start_time', endOfMonth.toISOString())
      .order('start_time', { ascending: false });

    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const { data: prevSessions } = await supabase
      .from('work_sessions')
      .select('id, start_time, end_time, status')
      .eq('worker_id', user.id)
      .gte('start_time', startOfPrevMonth.toISOString())
      .lte('start_time', endOfPrevMonth.toISOString());

    // Only approved sessions count for payroll
    const calcApprovedHours = (sessions: Array<{ start_time?: string; end_time?: string; status?: string }>) => {
      let total = 0;
      (sessions || []).forEach(s => {
        if (s.status === 'approved' && s.start_time && s.end_time) {
          total += (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / (1000 * 60 * 60);
        }
      });
      return Math.round(total * 100) / 100;
    };

    // Pending hours = clocked_out / auto_closed / pending_review with end_time set
    const calcPendingHours = (sessions: Array<{ start_time?: string; end_time?: string; status?: string }>) => {
      let total = 0;
      (sessions || []).forEach(s => {
        if (s.status && s.status !== 'approved' && s.status !== 'active' && s.start_time && s.end_time) {
          total += (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / (1000 * 60 * 60);
        }
      });
      return Math.round(total * 100) / 100;
    };

    const currentHours = calcApprovedHours(currentSessions || []);
    const currentPendingHours = calcPendingHours(currentSessions || []);
    const prevHours = calcApprovedHours(prevSessions || []);

    // Format sessions for display (all statuses; UI can show badges)
    const sessions = (currentSessions || []).map(s => {
      const p = s.places as unknown as { name?: string } | { name?: string }[] | null;
      const sk = s.skills as unknown as { name?: string } | { name?: string }[] | null;
      const placeName = p ? (Array.isArray(p) ? p[0]?.name : p.name) || 'Unknown Location' : 'Unknown Location';
      const skillName = sk ? (Array.isArray(sk) ? sk[0]?.name : sk.name) || '' : '';
      return {
        id: s.id,
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status,
        place_name: placeName,
        skill_name: skillName,
        hours: s.end_time
          ? Math.round(((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / (1000 * 60 * 60)) * 100) / 100
          : null,
      };
    });

    return NextResponse.json({
      hourly_rate: hourlyRate,
      current_month: {
        label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        hours: currentHours,
        pending_hours: currentPendingHours,
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
