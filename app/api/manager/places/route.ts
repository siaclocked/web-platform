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

    // Get manager's company
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

    // Get all places for this manager's company
    const { data: places, error } = await supabase
      .from('places')
      .select('*')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      // If table doesn't exist, return empty array
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('Places table does not exist yet');
        return NextResponse.json({ 
          places: [] 
        });
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Get worker counts for each place using worker_places junction table
    let placesWithCounts = places || [];
    if (placesWithCounts.length > 0) {
      try {
        placesWithCounts = await Promise.all(
          placesWithCounts.map(async (place) => {
            try {
              const { count } = await supabase
                .from('worker_places')
                .select('*', { count: 'exact', head: true })
                .eq('place_id', place.id)
                .eq('is_active', true);

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
      } catch (promiseError) {
        console.error('Error processing place counts:', promiseError);
        // Continue without counts if there's an error
      }
    }

    return NextResponse.json({ 
      places: placesWithCounts 
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, address } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Place name is required' },
        { status: 400 }
      );
    }

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

    // Get manager's company
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

    // Create place
    const { data, error } = await supabase
      .from('places')
      .insert({
        name: name.trim(),
        address: address?.trim() || null,
        manager_id: user.id,
        company_id: userData.company_id,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('Place created successfully:', { placeId: data.id, managerId: user.id });

    return NextResponse.json({ 
      success: true, 
      place: data 
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
