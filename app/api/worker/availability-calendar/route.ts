import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createBulkNotifications, NOTIFICATION_TYPES } from '@/lib/notifications';

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

async function getUser(request: Request) {
  const supabase = getSupabase();
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// GET: Load availability for a date range
export async function GET(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const supabase = getSupabase();
    let query = supabase
      .from('worker_availability')
      .select('*')
      .eq('worker_id', user.id)
      .order('date', { ascending: true });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching availability:', error);
      // Table might not exist yet
      if (error.code === '42P01') {
        return NextResponse.json({ entries: [], message: 'Table not migrated yet' });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entries: data || [] });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Save/update availability entries (upsert by worker_id + date)
export async function POST(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { entries } = await request.json() as { entries: AvailabilityEntry[] };

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'Entries array is required' }, { status: 400 });
    }

    // Validate entries
    for (const entry of entries) {
      if (!entry.date || !entry.availability_type) {
        return NextResponse.json({ error: 'Each entry requires date and availability_type' }, { status: 400 });
      }
      if (entry.availability_type === 'available_range') {
        if (!entry.start_time || !entry.end_time) {
          return NextResponse.json({ error: 'available_range requires start_time and end_time' }, { status: 400 });
        }
      }
    }

    const supabase = getSupabase();

    const upsertData = entries.map(entry => ({
      worker_id: user.id,
      date: entry.date,
      availability_type: entry.availability_type,
      start_time: entry.availability_type === 'available_range' ? entry.start_time : null,
      end_time: entry.availability_type === 'available_range' ? entry.end_time : null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('worker_availability')
      .upsert(upsertData, { onConflict: 'worker_id,date' });

    if (error) {
      console.error('Error saving availability:', error);
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'worker_availability table not found. Please run migration 022.' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify the worker's manager(s) about the availability update
    try {
      const supabaseNotif = getSupabase();
      // Get worker name
      const { data: workerData } = await supabaseNotif
        .from('users')
        .select('first_name, last_name, company_id')
        .eq('id', user.id)
        .single();

      if (workerData) {
        const workerName = `${workerData.first_name || ''} ${workerData.last_name || ''}`.trim() || 'A worker';

        // Find all managers in the same company
        const { data: managers } = await supabaseNotif
          .from('users')
          .select('id')
          .eq('company_id', workerData.company_id)
          .eq('role', 'manager');

        const managerIds = (managers || []).map(m => m.id);
        if (managerIds.length > 0) {
          await createBulkNotifications({
            userIds: managerIds,
            type: NOTIFICATION_TYPES.WORKER_AVAILABILITY_SET,
            title: 'Worker Availability Updated',
            message: `${workerName} has set their availability! Check it out in the Worker Availability page.`,
            metadata: { worker_id: user.id },
          });
        }
      }
    } catch (notifErr) {
      console.error('Error sending availability notification:', notifErr);
      // Don't block the response for notification failures
    }

    return NextResponse.json({
      success: true,
      message: `Saved availability for ${entries.length} day(s)`
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove availability for specific dates
export async function DELETE(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { dates } = await request.json() as { dates: string[] };

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ error: 'Dates array is required' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { error } = await supabase
      .from('worker_availability')
      .delete()
      .eq('worker_id', user.id)
      .in('date', dates);

    if (error) {
      console.error('Error deleting availability:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Removed availability for ${dates.length} day(s)`
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
