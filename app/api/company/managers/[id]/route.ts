import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: managerId } = await params;
    const supabase = getServiceSupabase();

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify caller is admin of same company
    const { data: callerData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!callerData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get manager info
    const { data: manager, error: managerError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, phone, is_active, created_at')
      .eq('id', managerId)
      .eq('role', 'manager')
      .eq('company_id', callerData.company_id)
      .single();

    if (managerError || !manager) {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
    }

    // Get places this manager manages
    const { data: places } = await supabase
      .from('places')
      .select('id, name, address')
      .eq('manager_id', managerId)
      .eq('company_id', callerData.company_id)
      .order('name', { ascending: true });

    // For each place, get worker count
    const placesWithCounts = await Promise.all(
      (places || []).map(async (place: any) => {
        const { count } = await supabase
          .from('worker_places')
          .select('*', { count: 'exact', head: true })
          .eq('place_id', place.id)
          .eq('is_active', true);
        return { ...place, worker_count: count || 0 };
      })
    );

    // Get all workers from places this manager manages
    const placeIds = (places || []).map((p: any) => p.id);
    let workers: any[] = [];
    if (placeIds.length > 0) {
      const { data: workerPlaces } = await supabase
        .from('worker_places')
        .select('worker_id, place_id')
        .in('place_id', placeIds)
        .eq('is_active', true);

      const workerIds = [...new Set((workerPlaces || []).map((wp: any) => wp.worker_id))];
      if (workerIds.length > 0) {
        const { data: workersData } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, phone, is_active, hourly_rate')
          .in('id', workerIds)
          .eq('role', 'worker')
          .order('first_name', { ascending: true });

        // Map workers to their places
        workers = (workersData || []).map((w: any) => {
          const wpEntries = (workerPlaces || []).filter((wp: any) => wp.worker_id === w.id);
          const workerPlaceNames = wpEntries.map((wp: any) => {
            const p = (places || []).find((pl: any) => pl.id === wp.place_id);
            return p ? p.name : 'Unknown';
          });
          return { ...w, place_names: workerPlaceNames };
        });
      }
    }

    return NextResponse.json({
      manager,
      places: placesWithCounts,
      workers,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: managerId } = await params;
    const supabase = getServiceSupabase();

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: callerData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!callerData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { first_name, last_name, email, phone } = body;

    const { error: updateError } = await supabase
      .from('users')
      .update({
        first_name,
        last_name,
        email,
        phone: phone || null,
      })
      .eq('id', managerId)
      .eq('role', 'manager')
      .eq('company_id', callerData.company_id);

    if (updateError) {
      console.error('Error updating manager:', updateError);
      return NextResponse.json({ error: 'Failed to update manager' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
