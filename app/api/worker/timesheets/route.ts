import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
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

    // Get current user from session
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get worker's user record to get company_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get all places this worker is assigned to
    const { data: workerPlaces, error: placesError } = await supabase
      .from('worker_places')
      .select('place_id')
      .eq('worker_id', user.id)
      .eq('is_active', true);

    console.log('Worker places lookup:', {
      workerId: user.id,
      workerPlaces: workerPlaces,
      placesError: placesError?.message
    });

    if (placesError) {
      console.error('Error fetching worker places:', placesError);
      return NextResponse.json(
        { error: 'Failed to fetch worker places' },
        { status: 500 }
      );
    }

    if (!workerPlaces || workerPlaces.length === 0) {
      console.log('Worker has no places assigned:', user.id);
      return NextResponse.json({
        timesheets: [],
        message: 'You are not assigned to any places. Please contact your manager.'
      });
    }

    const placeIds = workerPlaces.map(wp => wp.place_id);

    console.log('Fetching timesheets for places:', placeIds);

    // Get published timesheets for worker's places that have a future deadline
    const { data: timesheets, error: timesheetsError } = await supabase
      .from('schedule_templates')
      .select(`
        id,
        name,
        place_id,
        start_date,
        end_date,
        availability_deadline,
        status,
        created_at,
        places:place_id (
          id,
          name,
          address
        )
      `)
      .in('place_id', placeIds)
      .eq('status', 'published')
      .gt('availability_deadline', new Date().toISOString())
      .order('availability_deadline', { ascending: true });

    console.log('Timesheets query result:', {
      placeIds,
      timesheetsFound: timesheets?.length || 0,
      timesheets: timesheets?.map(t => ({ id: t.id, name: t.name, status: t.status, place_id: t.place_id })),
      error: timesheetsError?.message
    });

    if (timesheetsError) {
      console.error('Error fetching timesheets:', timesheetsError);
      return NextResponse.json(
        { error: 'Failed to fetch timesheets' },
        { status: 500 }
      );
    }

    // Get worker's skills
    const { data: workerSkills, error: skillsError } = await supabase
      .from('worker_skills')
      .select('skill_id, skills:skill_id (id, name)')
      .eq('worker_id', user.id);

    if (skillsError) {
      console.error('Error fetching worker skills:', skillsError);
    }

    const workerSkillIds = workerSkills?.map(ws => ws.skill_id) || [];

    // For each timesheet, get the shift templates
    const timesheetsWithShifts = await Promise.all(
      (timesheets || []).map(async (timesheet) => {
        const { data: shiftTemplates, error: shiftsError } = await supabase
          .from('shift_templates')
          .select('*')
          .eq('schedule_template_id', timesheet.id)
          .order('date', { ascending: true });

        if (shiftsError) {
          console.error('Error fetching shift templates:', shiftsError);
          return { ...timesheet, shift_templates: [], worker_skill_ids: workerSkillIds };
        }

        // Get worker's existing availability submissions for this timesheet
        const { data: submissions, error: submissionsError } = await supabase
          .from('worker_availability_submissions')
          .select('*')
          .eq('schedule_template_id', timesheet.id)
          .eq('worker_id', user.id);

        if (submissionsError) {
          console.error('Error fetching submissions:', submissionsError);
        }

        // Create a lookup for existing submissions
        const submissionLookup: Record<string, boolean> = {};
        (submissions || []).forEach(sub => {
          const key = `${sub.shift_template_id}-${sub.shift_index}`;
          submissionLookup[key] = sub.is_available;
        });

        return {
          ...timesheet,
          shift_templates: shiftTemplates || [],
          worker_skill_ids: workerSkillIds,
          existing_submissions: submissionLookup
        };
      })
    );

    return NextResponse.json({
      timesheets: timesheetsWithShifts,
      worker_skills: workerSkills?.map(ws => ({
        id: ws.skill_id,
        name: (ws.skills as any)?.name || 'Unknown'
      })) || []
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
