import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: placeId } = await params;
    
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
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get the place to verify it belongs to the company
    const { data: place, error: placeError } = await supabase
      .from('places')
      .select('*')
      .eq('id', placeId)
      .eq('company_id', userData.company_id)
      .single();

    if (placeError || !place) {
      return NextResponse.json(
        { error: 'Place not found' },
        { status: 404 }
      );
    }

    // Get workers assigned to this place via worker_places junction table
    const { data: workerPlaces, error: wpError } = await supabase
      .from('worker_places')
      .select('worker_id')
      .eq('place_id', placeId)
      .eq('is_active', true);

    if (wpError) {
      console.error('Error fetching worker_places:', wpError);
      return NextResponse.json(
        { error: 'Failed to fetch workers' },
        { status: 500 }
      );
    }

    const workerIds = (workerPlaces || []).map((wp: any) => wp.worker_id);

    let formattedWorkers: any[] = [];
    if (workerIds.length > 0) {
      const { data: workers, error: workersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, phone, is_active, hourly_rate, created_at')
        .in('id', workerIds)
        .order('first_name', { ascending: true });

      if (workersError) {
        console.error('Error fetching workers:', workersError);
      } else {
        // Get positions for each worker via worker_skills
        formattedWorkers = await Promise.all(
          (workers || []).map(async (worker: any) => {
            const { data: workerSkills } = await supabase
              .from('worker_skills')
              .select('skill_id, skills:skill_id (id, name, color)')
              .eq('worker_id', worker.id);

            const positions = (workerSkills || [])
              .filter((ws: any) => ws.skills)
              .map((ws: any) => {
                const s = ws.skills as any;
                return {
                  id: Array.isArray(s) ? s[0]?.id : s.id,
                  name: Array.isArray(s) ? s[0]?.name : s.name,
                  color: Array.isArray(s) ? s[0]?.color : s.color,
                };
              });

            return { ...worker, positions };
          })
        );
      }
    }

    return NextResponse.json({ 
      place: {
        ...place,
        worker_count: formattedWorkers.length,
      },
      workers: formattedWorkers 
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
