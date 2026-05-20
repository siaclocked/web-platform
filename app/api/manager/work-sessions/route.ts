import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET: List work_sessions for all workers in this manager's company.
// Optional query: ?status=pending_review|clocked_out|auto_closed|approved
//                 ?limit=50 (default 50, max 200)
export async function GET(request: Request) {
  try {
    const supabase = getSupabase();
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!userData || (userData.role !== 'manager' && userData.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const { data: workers } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('company_id', userData.company_id)
      .eq('role', 'worker');

    const workerIds = (workers || []).map(w => w.id);
    if (workerIds.length === 0) return NextResponse.json({ sessions: [] });

    let query = supabase
      .from('work_sessions')
      .select(`
        id, worker_id, place_id, start_time, end_time, status,
        scheduled_end_minutes, approved_by, approved_at,
        places (name)
      `)
      .in('worker_id', workerIds)
      .order('start_time', { ascending: false })
      .limit(limit);

    if (statusFilter) query = query.eq('status', statusFilter);

    const { data: sessions, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const workerMap = new Map((workers || []).map(w => [w.id, `${w.first_name || ''} ${w.last_name || ''}`.trim() || 'Unknown']));

    const enriched = (sessions || []).map((s: { worker_id: string; [k: string]: unknown }) => ({
      ...s,
      worker_name: workerMap.get(s.worker_id) || 'Unknown',
    }));

    return NextResponse.json({ sessions: enriched });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
