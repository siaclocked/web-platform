import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getUser(request: Request) {
  const supabase = getSupabase();
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// PATCH: Worker edits start/end on one of their past sessions.
// Status flips to 'pending_review' so a manager re-approves.
// Cannot edit while session is 'active' or 'approved'.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await context.params;
    const { start_time, end_time } = await request.json() as {
      start_time?: string;
      end_time?: string;
    };

    if (!start_time && !end_time) {
      return NextResponse.json({ error: 'At least one of start_time or end_time is required' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: session, error: fetchError } = await supabase
      .from('work_sessions')
      .select('id, worker_id, status, start_time, end_time')
      .eq('id', id)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.worker_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.status === 'active') {
      return NextResponse.json({ error: 'Cannot edit an active session — clock out first' }, { status: 400 });
    }

    if (session.status === 'approved') {
      return NextResponse.json({ error: 'This session has been approved and is locked. Ask your manager to unlock it.' }, { status: 400 });
    }

    const newStart = start_time || session.start_time;
    const newEnd = end_time || session.end_time;

    if (newStart && newEnd && new Date(newEnd).getTime() <= new Date(newStart).getTime()) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('work_sessions')
      .update({
        start_time: newStart,
        end_time: newEnd,
        status: 'pending_review',
        approved_by: null,
        approved_at: null,
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
