import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
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
