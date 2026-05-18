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

    // Get manager's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all active work sessions for workers in this company
    const { data: activeSessions, error } = await supabase
      .from('work_sessions')
      .select(`
        id,
        worker_id,
        place_id,
        skill_id,
        start_time,
        is_scheduled,
        users:worker_id (
          first_name,
          last_name
        ),
        places:place_id (
          name
        ),
        skills:skill_id (
          name
        )
      `)
      .is('end_time', null)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching active sessions:', error);
      // Table might not exist yet
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json({ sessions: [], count: 0 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter to only workers in the same company
    const { data: companyWorkers } = await supabase
      .from('users')
      .select('id')
      .eq('company_id', userData.company_id)
      .eq('role', 'worker');

    const companyWorkerIds = new Set((companyWorkers || []).map(w => w.id));

    const filteredSessions = (activeSessions || [])
      .filter(s => companyWorkerIds.has(s.worker_id))
      .map(s => ({
        id: s.id,
        worker_name: `${(s.users as any)?.first_name || ''} ${(s.users as any)?.last_name || ''}`.trim(),
        place_name: (s.places as any)?.name || 'Unknown',
        skill_name: (s.skills as any)?.name || 'Unknown',
        start_time: s.start_time,
        is_scheduled: s.is_scheduled,
        duration_minutes: Math.floor((Date.now() - new Date(s.start_time).getTime()) / (1000 * 60)),
      }));

    return NextResponse.json({
      sessions: filteredSessions,
      count: filteredSessions.length,
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
