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
    // Try with status/start_date first, fall back to basic columns if those don't exist
    type WorkerRow = {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone?: string | null;
      is_active: boolean;
      hourly_rate?: number | null;
      monthly_min_hours?: number | null;
      monthly_optimal_hours?: number | null;
      status?: string;
      start_date?: string | null;
      can_open?: boolean;
      can_close?: boolean;
    };

    let workers: WorkerRow[] | null = null;
    let error: { message?: string } | null = null;

    const result = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        is_active,
        hourly_rate,
        monthly_min_hours,
        monthly_optimal_hours,
        status,
        start_date,
        can_open,
        can_close
      `)
      .eq('role', 'worker')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false });

    if (
        result.error &&
      (
        result.error.message?.includes('status') ||
        result.error.message?.includes('start_date') ||
        result.error.message?.includes('monthly_min_hours') ||
        result.error.message?.includes('monthly_optimal_hours') ||
        result.error.message?.includes('can_open') ||
        result.error.message?.includes('can_close')
      )
    ) {
      // Fallback: new columns may not exist yet — query without them
      const fallback = await supabase
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          is_active,
          hourly_rate
        `)
        .eq('role', 'worker')
        .eq('company_id', userData.company_id)
        .order('created_at', { ascending: false });

      workers = fallback.data as WorkerRow[] | null;
      error = fallback.error;
    } else {
      workers = result.data as WorkerRow[] | null;
      error = result.error;
    }

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Get all skills (positions) and places for lookup
    // Note: worker_skills references the skills table, not positions table
    const { data: allSkills } = await supabase
      .from('skills')
      .select('id, name')
      .eq('company_id', userData.company_id);
    
    const { data: allPlaces } = await supabase
      .from('places')
      .select('id, name')
      .eq('company_id', userData.company_id);

    const positionMap = (allSkills || []).reduce((acc: { [key: string]: string }, skill: { id: string; name: string }) => {
      acc[skill.id] = skill.name;
      return acc;
    }, {} as { [key: string]: string });

    const placeMap = (allPlaces || []).reduce((acc, place) => {
      acc[place.id] = place.name;
      return acc;
    }, {} as { [key: string]: string });

    // Get worker skills (positions) and places for all workers
    const workerIds = (workers || []).map(w => w.id);
    
    const workerSkillsMap: { [key: string]: Array<{ id: string; name: string; rating: number }> } = {};
    const workerPlacesMap: { [key: string]: Array<{ id: string; name: string }> } = {};

    if (workerIds.length > 0) {
      // Get worker skills
      const { data: workerSkills } = await supabase
        .from('worker_skills')
        .select('worker_id, skill_id, rating')
        .in('worker_id', workerIds);
      
      (workerSkills || []).forEach(ws => {
        if (!workerSkillsMap[ws.worker_id]) {
          workerSkillsMap[ws.worker_id] = [];
        }
        if (positionMap[ws.skill_id]) {
          workerSkillsMap[ws.worker_id].push({
            id: ws.skill_id,
            name: positionMap[ws.skill_id],
            rating: ws.rating ?? 5
          });
        }
      });

      // Get worker places
      const { data: workerPlaces } = await supabase
        .from('worker_places')
        .select('worker_id, place_id')
        .in('worker_id', workerIds);
      
      (workerPlaces || []).forEach(wp => {
        if (!workerPlacesMap[wp.worker_id]) {
          workerPlacesMap[wp.worker_id] = [];
        }
        if (placeMap[wp.place_id]) {
          workerPlacesMap[wp.worker_id].push({
            id: wp.place_id,
            name: placeMap[wp.place_id]
          });
        }
      });
    }

    // Format the response with positions and places arrays
    const formattedWorkers = (workers || []).map(worker => ({
      ...worker,
      positions: workerSkillsMap[worker.id] || [],
      places: workerPlacesMap[worker.id] || []
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
