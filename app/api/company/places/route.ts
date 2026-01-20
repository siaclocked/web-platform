import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Create service role client to bypass RLS for data access
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
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get all managers in the company
    const { data: managers, error: managersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('company_id', userData.company_id)
      .eq('role', 'manager')
      .eq('is_active', true);

    if (managersError) {
      console.error('Error fetching managers:', managersError);
      return NextResponse.json(
        { error: 'Failed to fetch managers' },
        { status: 500 }
      );
    }

    // Get places with worker counts for each manager
    const managersWithPlaces = await Promise.all(
      (managers || []).map(async (manager) => {
        try {
          // Get places for this manager
          const { data: places, error: placesError } = await supabase
            .from('places')
            .select('*')
            .eq('manager_id', manager.id)
            .eq('company_id', userData.company_id)
            .order('created_at', { ascending: false });

          if (placesError) {
            console.error('Error fetching places for manager:', manager.id, placesError);
            return {
              ...manager,
              places: [],
              total_places: 0,
              total_workers: 0,
            };
          }

          // Get worker counts for each place
          const placesWithCounts = await Promise.all(
            (places || []).map(async (place) => {
              try {
                const { count } = await supabase
                  .from('users')
                  .select('*', { count: 'exact', head: true })
                  .eq('place_id', place.id)
                  .eq('company_id', userData.company_id);

                return {
                  ...place,
                  worker_count: count || 0,
                };
              } catch (countError) {
                console.error('Error getting worker count for place:', place.id, countError);
                return {
                  ...place,
                  worker_count: 0,
                };
              }
            })
          );

          const totalWorkers = placesWithCounts.reduce((sum, place) => sum + (place.worker_count || 0), 0);

          return {
            ...manager,
            places: placesWithCounts,
            total_places: placesWithCounts.length,
            total_workers: totalWorkers,
          };
        } catch (error) {
          console.error('Error processing manager places:', manager.id, error);
          return {
            ...manager,
            places: [],
            total_places: 0,
            total_workers: 0,
          };
        }
      })
    );

    return NextResponse.json({ 
      managers: managersWithPlaces 
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
