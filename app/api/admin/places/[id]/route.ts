import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: placeIdParam } = await params;
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (userData.role !== 'manager') {
      return NextResponse.json(
        { error: 'Only company admins can access this endpoint' },
        { status: 403 }
      );
    }

    const placeId = placeIdParam;

    // Get place details
    const { data: place, error: placeError } = await supabase
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
          email,
          phone
        )
      `)
      .eq('id', placeId)
      .eq('company_id', userData.company_id)
      .single();

    if (placeError || !place) {
      return NextResponse.json(
        { error: 'Place not found' },
        { status: 404 }
      );
    }

    // Get workers assigned to this place with their positions
    const { data: workerPlaces, error: workerPlacesError } = await supabase
      .from('worker_places')
      .select('worker_id')
      .eq('place_id', placeId)
      .eq('is_active', true);

    if (workerPlacesError) {
      console.error('Error fetching worker places:', workerPlacesError);
      return NextResponse.json(
        { error: 'Failed to fetch workers' },
        { status: 500 }
      );
    }

    const workerIds = (workerPlaces || []).map(wp => wp.worker_id);

    interface Position {
      id: string;
      name: string;
      color: string;
    }

    interface Worker {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
      hourly_rate?: number;
      is_active: boolean;
      positions: Position[];
    }

    let workers: Worker[] = [];
    if (workerIds.length > 0) {
      const { data: workersData, error: workersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, phone, hourly_rate, is_active')
        .in('id', workerIds)
        .eq('role', 'worker')
        .order('first_name', { ascending: true });

      if (workersError) {
        console.error('Error fetching workers:', workersError);
      } else {
        // Get positions (skills) for each worker
        const workersWithPositions = await Promise.all(
          (workersData || []).map(async (worker) => {
            const { data: workerSkills, error: skillsError } = await supabase
              .from('worker_skills')
              .select('skill_id, skills:skill_id (id, name, color)')
              .eq('worker_id', worker.id);

            if (skillsError) {
              console.error('Error fetching worker skills:', skillsError);
            }

            const positions: Position[] = (workerSkills || [])
              .filter(ws => ws.skills)
              .map(ws => ({
                id: (ws.skills as any).id || '',
                name: (ws.skills as any).name || 'Unknown',
                color: (ws.skills as any).color || '#3b82f6'
              }));

            return {
              ...worker,
              positions
            } as Worker;
          })
        );

        workers = workersWithPositions;
      }
    }

    // Get active schedules for this place
    const { data: schedules, error: schedulesError } = await supabase
      .from('schedule_templates')
      .select(`
        id,
        name,
        start_date,
        end_date,
        status,
        availability_deadline,
        created_at,
        manager:manager_id (
          id,
          first_name,
          last_name
        )
      `)
      .eq('place_id', placeId)
      .in('status', ['draft', 'published'])
      .order('start_date', { ascending: false });

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      return NextResponse.json(
        { error: 'Failed to fetch schedules' },
        { status: 500 }
      );
    }

    // Get shift counts for each schedule
    const schedulesWithCounts = await Promise.all(
      (schedules || []).map(async (schedule) => {
        const { count: shiftCount } = await supabase
          .from('shift_templates')
          .select('*', { count: 'exact', head: true })
          .eq('schedule_template_id', schedule.id);

        const { count: submissionCount } = await supabase
          .from('worker_availability_submissions')
          .select('worker_id', { count: 'exact', head: true })
          .eq('schedule_template_id', schedule.id);

        return {
          ...schedule,
          shift_count: shiftCount || 0,
          submission_count: submissionCount || 0
        };
      })
    );

    return NextResponse.json({
      place,
      workers,
      schedules: schedulesWithCounts
    });
  } catch (error) {
    console.error('Error in admin place details endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
