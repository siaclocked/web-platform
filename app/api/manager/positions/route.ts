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

    // Get manager's company and positions
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

    // Get positions - simplified query without complex join
    const { data: positions, error } = await supabase
      .from('positions')
      .select('*')
      .eq('manager_id', user.id)
      .eq('company_id', userData.company_id);

    if (error) {
      console.error('Database error:', error);
      // If table doesn't exist, return empty array
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('Positions table does not exist yet');
        return NextResponse.json({ 
          positions: [] 
        });
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Get worker counts for each position (only if positions exist)
    let positionsWithCounts = positions || [];
    if (positionsWithCounts.length > 0) {
      try {
        positionsWithCounts = await Promise.all(
          positionsWithCounts.map(async (position) => {
            try {
              const { count } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('position_id', position.id)
                .eq('manager_id', user.id);

              return {
                ...position,
                worker_count: count || 0,
              };
            } catch (countError) {
              console.error('Error getting worker count for position:', position.id, countError);
              return {
                ...position,
                worker_count: 0,
              };
            }
          })
        );
      } catch (aggregateError) {
        console.error('Error aggregating worker counts:', aggregateError);
        // Continue without worker counts
      }
    }

    return NextResponse.json({ 
      positions: positionsWithCounts 
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
    const { name, description } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Position name is required' },
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

    // Get current user from session - try multiple methods
    let user = null;
    let authError = null;

    // Method 1: Check Authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const result = await supabase.auth.getUser(token);
      user = result.data.user;
      authError = result.error;
    }

    // Method 2: If no header, try to get from cookies (for client-side requests)
    if (!user && !authError) {
      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser();
      user = cookieUser;
      authError = cookieError;
    }

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

    // Create position
    const { data, error } = await supabase
      .from('positions')
      .insert({
        company_id: userData.company_id,
        manager_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      // If table doesn't exist, provide a helpful error
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json(
          { error: 'Positions table not found. Please run the database migration first.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('Position created successfully:', { positionId: data.id, managerId: user.id });

    return NextResponse.json({ 
      success: true, 
      position: data 
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
