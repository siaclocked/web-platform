import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Create service role client to bypass RLS
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

    // Get user from session token in request
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's company
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch company stats for this company
    const [managers, workers, places, schedules] = await Promise.all([
      supabase.from('users').select('id').eq('role', 'manager').eq('company_id', userData.company_id),
      supabase.from('users').select('id').eq('role', 'worker').eq('company_id', userData.company_id),
      supabase.from('places').select('id').eq('company_id', userData.company_id),
      supabase.from('schedules').select('id').eq('status', 'PUBLISHED').eq('company_id', userData.company_id)
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
