import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getManager(request: Request) {
  const supabase = getSupabase();
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('id, role, company_id')
    .eq('id', user.id)
    .single();

  if (!userData) return null;
  if (userData.role !== 'manager' && userData.role !== 'admin') return null;
  return userData;
}

// PATCH: Manager edits and/or approves a worker's session.
// Body shape:
//   { action: 'approve' }                    -> set status='approved', stamp approver
//   { action: 'unlock' }                     -> set status='pending_review' (reopen an approved row)
//   { action: 'edit', start_time?, end_time? } -> manager overrides times, status='pending_review'
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const manager = await getManager(request);
    if (!manager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json() as {
      action: 'approve' | 'unlock' | 'edit';
      start_time?: string;
      end_time?: string;
    };

    const supabase = getSupabase();

    const { data: session, error: fetchError } = await supabase
      .from('work_sessions')
      .select('id, worker_id, status, start_time, end_time, users:worker_id (company_id)')
      .eq('id', id)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const workerCompany = (session.users as unknown as { company_id: string })?.company_id;
    if (workerCompany !== manager.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (body.action === 'approve') {
      if (session.status === 'active') {
        return NextResponse.json({ error: 'Cannot approve an active session' }, { status: 400 });
      }
      const { error } = await supabase
        .from('work_sessions')
        .update({
          status: 'approved',
          approved_by: manager.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, status: 'approved' });
    }

    if (body.action === 'unlock') {
      const { error } = await supabase
        .from('work_sessions')
        .update({
          status: 'pending_review',
          approved_by: null,
          approved_at: null,
        })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, status: 'pending_review' });
    }

    if (body.action === 'edit') {
      if (session.status === 'active') {
        return NextResponse.json({ error: 'Cannot edit an active session' }, { status: 400 });
      }
      const newStart = body.start_time || session.start_time;
      const newEnd = body.end_time || session.end_time;

      if (newStart && newEnd && new Date(newEnd).getTime() <= new Date(newStart).getTime()) {
        return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
      }

      const { error } = await supabase
        .from('work_sessions')
        .update({
          start_time: newStart,
          end_time: newEnd,
          status: 'pending_review',
          approved_by: null,
          approved_at: null,
        })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, status: 'pending_review' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: List sessions for a worker in this manager's company, with status filter.
// /api/manager/work-sessions/[id]?status=pending_review (id is workerId here? no — use ?worker_id)
// Actually for this route the [id] is a session id, so GET is single-session detail
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const manager = await getManager(request);
    if (!manager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await context.params;
    const supabase = getSupabase();

    const { data: session, error } = await supabase
      .from('work_sessions')
      .select(`
        id, worker_id, place_id, skill_id, start_time, end_time, status,
        scheduled_end_minutes, handoff_note, approved_by, approved_at,
        users:worker_id (first_name, last_name, company_id),
        places (name)
      `)
      .eq('id', id)
      .single();

    if (error || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const workerCompany = (session.users as unknown as { company_id: string })?.company_id;
    if (workerCompany !== manager.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ session });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
