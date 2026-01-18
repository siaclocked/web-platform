import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Create service role client to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Fetch company stats
    const [managers, workers, places, schedules] = await Promise.all([
      supabase.from('users').select('id').eq('role', 'manager'),
      supabase.from('users').select('id').eq('role', 'worker'),
      supabase.from('places').select('id'),
      supabase.from('schedules').select('id').eq('status', 'PUBLISHED')
    ]);

    const stats = {
      totalManagers: managers.data?.length || 0,
      totalWorkers: workers.data?.length || 0,
      totalPlaces: places.data?.length || 0,
      activeSchedules: schedules.data?.length || 0
    };

    console.log('Company stats:', stats);

    return NextResponse.json(stats);
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
