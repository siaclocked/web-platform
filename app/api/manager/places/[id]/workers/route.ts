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

    // Extract worker IDs
    const workerIds = (workerPlaces || []).map((wp: any) => wp.worker_id);

    // Fetch worker_skills with skill names for all workers
    let workerSkillsMap: Record<string, string[]> = {};
    if (workerIds.length > 0) {
      const { data: workerSkills } = await supabase
        .from('worker_skills')
        .select('worker_id, skills:skill_id (name)')
        .in('worker_id', workerIds);

      (workerSkills || []).forEach((ws: any) => {
        const name = ws.skills?.name;
        if (name) {
          if (!workerSkillsMap[ws.worker_id]) workerSkillsMap[ws.worker_id] = [];
          workerSkillsMap[ws.worker_id].push(name);
        }
      });
    }

    // Extract and format worker data with positions
    const workers = (workerPlaces || [])
      .map((wp: any) => ({
        ...wp.users,
        positions: workerSkillsMap[wp.worker_id] || [],
      }))
      .filter((w: any) => w !== null && w.id);

    return NextResponse.json({ workers });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
