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

    // Get workers for this manager's company
    const { data: workers, error } = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        is_active,
        position_id,
        hourly_rate
      `)
      .eq('role', 'worker')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Get position names separately
    let positionNames: { [key: string]: string } = {};
    if (workers && workers.length > 0) {
      const positionIds = workers
        .filter(w => w.position_id)
        .map(w => w.position_id!)
        .filter((id, index, arr) => arr.indexOf(id) === index); // Unique IDs
      
      if (positionIds.length > 0) {
        const { data: positions } = await supabase
          .from('positions')
          .select('id, name')
          .in('id', positionIds);
        
        positionNames = (positions || []).reduce((acc, pos) => {
          acc[pos.id] = pos.name;
          return acc;
        }, {} as { [key: string]: string });
      }
    }

    // Format the response with position names
    const formattedWorkers = (workers || []).map(worker => ({
      ...worker,
      position_name: worker.position_id ? positionNames[worker.position_id] || null : null
    }));

    return NextResponse.json({ workers: formattedWorkers });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
