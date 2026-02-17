import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: placeId } = await params;

    if (!placeId) {
      return NextResponse.json(
        { error: 'Place ID is required' },
        { status: 400 }
      );
    }

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

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
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

    // Get workers assigned to this place via worker_places junction table
    const { data: workerPlaces, error: wpError } = await supabase
      .from('worker_places')
      .select(`
        worker_id,
        users:worker_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('place_id', placeId)
      .eq('is_active', true);

    if (wpError) {
      console.error('Error fetching worker places:', wpError);
      return NextResponse.json(
        { error: wpError.message },
        { status: 500 }
      );
    }

    // Extract and format worker data
    const workers = (workerPlaces || [])
      .map((wp: any) => wp.users)
      .filter((w: any) => w !== null);

    return NextResponse.json({ workers });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
