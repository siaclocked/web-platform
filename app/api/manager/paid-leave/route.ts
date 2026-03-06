import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getManagerUser(request: Request) {
  const supabase = getSupabase();
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('id, role, company_id')
    .eq('id', user.id)
    .single();

  if (!userData || userData.role !== 'manager') return null;
  return userData;
}

// GET: Fetch paid leave records for a worker or all workers
export async function GET(request: Request) {
  try {
    const manager = await getManagerUser(request);
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workerId = searchParams.get('worker_id');

    const supabase = getSupabase();

    let query = supabase
      .from('paid_leave')
      .select('*, worker:worker_id (first_name, last_name, email)')
      .eq('company_id', manager.company_id)
      .order('start_date', { ascending: false });

    if (workerId) {
      query = query.eq('worker_id', workerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching paid leave:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ paid_leave: data || [] });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Grant paid leave to a worker
export async function POST(request: Request) {
  try {
    const manager = await getManagerUser(request);
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { worker_id, start_date, end_date, notes } = await request.json();

    if (!worker_id || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'worker_id, start_date, and end_date are required' },
        { status: 400 }
      );
    }

    if (new Date(end_date) < new Date(start_date)) {
      return NextResponse.json(
        { error: 'end_date must be on or after start_date' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify worker belongs to same company
    const { data: worker } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('id', worker_id)
      .eq('company_id', manager.company_id)
      .single();

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    // Insert paid leave record
    const { data: paidLeave, error: insertError } = await supabase
      .from('paid_leave')
      .insert({
        worker_id,
        company_id: manager.company_id,
        start_date,
        end_date,
        granted_by: manager.id,
        notes: notes || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting paid leave:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Create vacation entries in worker_availability for each day in the range
    const start = new Date(start_date);
    const end = new Date(end_date);
    const entries = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      entries.push({
        worker_id,
        date: dateStr,
        availability_type: 'vacation',
        is_paid_leave: true,
        start_time: null,
        end_time: null,
        updated_at: new Date().toISOString(),
      });
    }

    if (entries.length > 0) {
      const { error: upsertError } = await supabase
        .from('worker_availability')
        .upsert(entries, { onConflict: 'worker_id,date' });

      if (upsertError) {
        console.error('Error creating vacation entries:', upsertError);
        // Don't fail the whole request, the paid_leave record is already created
      }
    }

    return NextResponse.json({
      success: true,
      paid_leave: paidLeave,
      days_flagged: entries.length,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove a paid leave record
export async function DELETE(request: Request) {
  try {
    const manager = await getManagerUser(request);
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get the paid leave record first to know the date range
    const { data: paidLeave } = await supabase
      .from('paid_leave')
      .select('*')
      .eq('id', id)
      .eq('company_id', manager.company_id)
      .single();

    if (!paidLeave) {
      return NextResponse.json({ error: 'Paid leave record not found' }, { status: 404 });
    }

    // Remove the vacation availability entries
    const start = new Date(paidLeave.start_date);
    const end = new Date(paidLeave.end_date);
    const dates = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    if (dates.length > 0) {
      await supabase
        .from('worker_availability')
        .delete()
        .eq('worker_id', paidLeave.worker_id)
        .in('date', dates)
        .eq('availability_type', 'vacation');
    }

    // Delete the paid leave record
    const { error } = await supabase
      .from('paid_leave')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
