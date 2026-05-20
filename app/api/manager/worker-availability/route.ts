import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

interface AvailabilityEntry {
  date: string;
  availability_type: 'available_all_day' | 'available_range' | 'unavailable' | 'vacation';
  start_time?: string | null;
  end_time?: string | null;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getManagerCompanyId(request: Request) {
  const supabase = getSupabase();
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return { error: 'Authentication required', status: 401 as const };

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return { error: 'Authentication required', status: 401 as const };

  const { data: userData } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  if (!userData) return { error: 'User not found', status: 404 as const };
  if (userData.role !== 'manager' && userData.role !== 'admin') {
    return { error: 'Forbidden', status: 403 as const };
  }
  return { companyId: userData.company_id, supabase };
}

async function verifyWorkerInCompany(supabase: ReturnType<typeof getSupabase>, workerId: string, companyId: string) {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('id', workerId)
    .eq('company_id', companyId)
    .single();
  return !!data;
}

// GET: Load all workers and their availability for the manager
export async function GET(request: Request) {
  try {
    const supabase = getSupabase();

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workerId = searchParams.get('worker_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Get manager's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If worker_id is provided, return that worker's availability
    if (workerId) {
      // Verify the worker belongs to the manager's company
      const { data: workerData } = await supabase
        .from('users')
        .select('id, first_name, last_name, company_id')
        .eq('id', workerId)
        .eq('company_id', userData.company_id)
        .single();

      if (!workerData) {
        return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
      }

      let query = supabase
        .from('worker_availability')
        .select('*')
        .eq('worker_id', workerId)
        .order('date', { ascending: true });

      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data: entries, error } = await query;

      if (error) {
        if (error.code === '42P01') {
          return NextResponse.json({ entries: [], worker: workerData });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        entries: entries || [],
        worker: {
          id: workerData.id,
          name: `${workerData.first_name || ''} ${workerData.last_name || ''}`.trim(),
        },
      });
    }

    // Otherwise return all workers in the company with role=worker
    const { data: workers } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('company_id', userData.company_id)
      .eq('role', 'worker')
      .order('first_name', { ascending: true });

    return NextResponse.json({
      workers: (workers || []).map(w => ({
        id: w.id,
        name: `${w.first_name || ''} ${w.last_name || ''}`.trim() || 'Unknown',
      })),
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Manager upserts availability on behalf of a worker
export async function POST(request: Request) {
  try {
    const auth = await getManagerCompanyId(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { worker_id, entries } = await request.json() as { worker_id: string; entries: AvailabilityEntry[] };

    if (!worker_id) return NextResponse.json({ error: 'worker_id is required' }, { status: 400 });
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'Entries array is required' }, { status: 400 });
    }

    const isInCompany = await verifyWorkerInCompany(auth.supabase, worker_id, auth.companyId);
    if (!isInCompany) return NextResponse.json({ error: 'Worker not found' }, { status: 404 });

    for (const entry of entries) {
      if (!entry.date || !entry.availability_type) {
        return NextResponse.json({ error: 'Each entry requires date and availability_type' }, { status: 400 });
      }
      if (entry.availability_type === 'available_range' && (!entry.start_time || !entry.end_time)) {
        return NextResponse.json({ error: 'available_range requires start_time and end_time' }, { status: 400 });
      }
    }

    const upsertData = entries.map(entry => ({
      worker_id,
      date: entry.date,
      availability_type: entry.availability_type,
      start_time: entry.availability_type === 'available_range' ? entry.start_time : null,
      end_time: entry.availability_type === 'available_range' ? entry.end_time : null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await auth.supabase
      .from('worker_availability')
      .upsert(upsertData, { onConflict: 'worker_id,date' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, message: `Saved availability for ${entries.length} day(s)` });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Manager removes worker's availability for specific dates
export async function DELETE(request: Request) {
  try {
    const auth = await getManagerCompanyId(request);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { worker_id, dates } = await request.json() as { worker_id: string; dates: string[] };

    if (!worker_id) return NextResponse.json({ error: 'worker_id is required' }, { status: 400 });
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ error: 'Dates array is required' }, { status: 400 });
    }

    const isInCompany = await verifyWorkerInCompany(auth.supabase, worker_id, auth.companyId);
    if (!isInCompany) return NextResponse.json({ error: 'Worker not found' }, { status: 404 });

    const { error } = await auth.supabase
      .from('worker_availability')
      .delete()
      .eq('worker_id', worker_id)
      .in('date', dates);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, message: `Removed availability for ${dates.length} day(s)` });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
