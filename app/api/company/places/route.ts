import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Create service role client to bypass RLS for data access
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

    // Get company user's company
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get all places for this company with manager info
    const { data: places, error: placesError } = await supabase
      .from('places')
      .select(`
        id,
        name,
        address,
        created_at,
        manager_id,
        manager:manager_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('company_id', userData.company_id)
      .order('name', { ascending: true });

    if (placesError) {
      console.error('Database error:', placesError);
      return NextResponse.json(
        { error: placesError.message },
        { status: 500 }
      );
    }

    // Get worker counts and schedule counts for each place
    const placesWithCounts = await Promise.all(
      (places || []).map(async (place) => {
        const { count: workerCount } = await supabase
          .from('worker_places')
          .select('*', { count: 'exact', head: true })
          .eq('place_id', place.id)
          .eq('is_active', true);

        const { count: scheduleCount } = await supabase
          .from('schedule_templates')
          .select('*', { count: 'exact', head: true })
          .eq('place_id', place.id)
          .in('status', ['draft', 'published']);

        return {
          ...place,
          worker_count: workerCount || 0,
          active_schedule_count: scheduleCount || 0
        };
      })
    );

    return NextResponse.json({ places: placesWithCounts || [] });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
