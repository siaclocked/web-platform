import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { 
  notifyManager, 
  NOTIFICATION_TYPES 
} from '@/lib/notifications';

const SOLVER_URL = process.env.SOLVER_URL || 'http://localhost:8000';

interface SolverRequest {
  place_id: string;
  start_date: string;
  end_date: string;
  workers: Array<{
    id: string;
    name: string;
    skill_ids: string[];
    place_ids: string[];
    skill_ratings: Record<string, number>;
    can_open: boolean;
    can_close: boolean;
  }>;
  skill_constraints: Array<{
    skill_id: string;
    enforce_min_team_rating: boolean;
    min_avg_rating: number | null;
  }>;
  coverage_windows: Array<{
    id: string;
    skill_id: string;
    day: number;
    start_minutes: number;
    end_minutes: number;
    min_workers: number;
  }>;
  unavailability: Array<{
    worker_id: string;
    day: number;
    start_minutes?: number;
    end_minutes?: number;
    is_full_day: boolean;
  }>;
  settings: {
    max_hours_per_day: number;
    min_hours_per_block: number;
    max_hours_per_block: number;
    min_rest_between_shifts: number;
    granularity_minutes: number;
  };
}

export async function POST(request: Request) {
  try {
    const { schedule_template_id } = await request.json();

    if (!schedule_template_id) {
      return NextResponse.json(
        { error: 'Schedule template ID is required' },
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

    // Get current user from session (must be manager)
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

    // Get the schedule template
    const { data: template, error: templateError } = await supabase
      .from('schedule_templates')
      .select(`
        *,
        places:place_id (
          id,
          name,
          settings
        )
      `)
      .eq('id', schedule_template_id)
      .eq('manager_id', user.id)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Schedule template not found' },
        { status: 404 }
      );
    }

    // Get shift templates
    const { data: shiftTemplates, error: shiftsError } = await supabase
      .from('shift_templates')
      .select('*')
      .eq('schedule_template_id', schedule_template_id)
      .order('date', { ascending: true });

    if (shiftsError) {
      console.error('Error fetching shift templates:', shiftsError);
      return NextResponse.json(
        { error: 'Failed to fetch shift templates' },
        { status: 500 }
      );
    }

    // Get workers at this place with their skills
    const { data: workerPlaces, error: workersError } = await supabase
      .from('worker_places')
      .select(`
        worker_id,
        users:worker_id (
          id,
          first_name,
          last_name,
          start_date,
          worker_rating,
          can_open,
          can_close
        )
      `)
      .eq('place_id', template.place_id)
      .eq('is_active', true);

    if (workersError) {
      console.error('Error fetching workers:', workersError);
      return NextResponse.json(
        { error: 'Failed to fetch workers' },
        { status: 500 }
      );
    }

    const workerIds = workerPlaces?.map(wp => wp.worker_id) || [];

    // Get worker skills
    const { data: workerSkills, error: skillsError } = await supabase
      .from('worker_skills')
      .select('worker_id, skill_id, rating')
      .in('worker_id', workerIds);

    if (skillsError) {
      console.error('Error fetching worker skills:', skillsError);
    }

    // Get worker availability from the calendar-based worker_availability table
    const { data: availEntries, error: availError } = await supabase
      .from('worker_availability')
      .select('*')
      .in('worker_id', workerIds)
      .gte('date', template.start_date)
      .lte('date', template.end_date);

    if (availError) {
      console.error('Error fetching worker availability:', availError);
    }

    // Build worker availability lookup: worker_id -> date -> entry
    const workerAvailMap: Record<string, Record<string, { type: string; start_time?: string; end_time?: string }>> = {};
    (availEntries || []).forEach((entry: {
      worker_id: string;
      date: string;
      availability_type: string;
      start_time?: string;
      end_time?: string;
    }) => {
      if (!workerAvailMap[entry.worker_id]) {
        workerAvailMap[entry.worker_id] = {};
      }
      workerAvailMap[entry.worker_id][entry.date] = {
        type: entry.availability_type,
        start_time: entry.start_time,
        end_time: entry.end_time,
      };
    });

    // Build workers array for solver
    type SolverWorker = SolverRequest['workers'][number];
    const workersMap: Record<string, SolverWorker> = {};
    workerPlaces?.forEach(wp => {
      const userData = wp.users as {
        first_name?: string;
        last_name?: string;
        worker_rating?: number;
        start_date?: string;
        can_open?: boolean;
        can_close?: boolean;
      } | null;
      workersMap[wp.worker_id] = {
        id: wp.worker_id,
        name: `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim() || 'Unknown',
        skill_ids: [],
        place_ids: [template.place_id],
        skill_ratings: {},
        worker_rating: userData?.worker_rating || 3,
        start_date: userData?.start_date || null,
        can_open: userData?.can_open ?? true,
        can_close: userData?.can_close ?? true,
      };
    });

    workerSkills?.forEach(ws => {
      if (workersMap[ws.worker_id]) {
        workersMap[ws.worker_id].skill_ids.push(ws.skill_id);
        workersMap[ws.worker_id].skill_ratings[ws.skill_id] = ws.rating || 3;
      }
    });

    // Build coverage windows from shift templates
    // Use day OFFSET from start_date (not day-of-week) to avoid duplicates
    // and the JS getDay() vs Python weekday() numbering mismatch.
    const coverageWindows: SolverRequest['coverage_windows'] = [];
    const startDateObj = new Date(template.start_date + 'T00:00:00');

    (shiftTemplates || []).forEach((st) => {
      if (st.day_type === 'work' && st.shifts) {
        const shiftDate = new Date(st.date + 'T00:00:00');
        const dayOffset = Math.round((shiftDate.getTime() - startDateObj.getTime()) / (24 * 60 * 60 * 1000));

        const shifts = st.shifts as Array<{ startTime: string; endTime: string; position: string; workers?: number }>;
        shifts.forEach((shift, shiftIndex: number) => {
          const [startH, startM] = shift.startTime.split(':').map(Number);
          const [endH, endM] = shift.endTime.split(':').map(Number);

          coverageWindows.push({
            id: `${st.id}-${shiftIndex}`,
            skill_id: shift.position,
            day: dayOffset,
            start_minutes: startH * 60 + startM,
            end_minutes: endH * 60 + endM,
            min_workers: shift.workers || 1
          });
        });
      }
    });

    const skillIdsInCoverage = [...new Set(coverageWindows.map((w) => w.skill_id))];
    let skillConstraints: SolverRequest['skill_constraints'] = [];
    if (skillIdsInCoverage.length > 0) {
      const { data: placeSkillConfigs, error: placeSkillError } = await supabase
        .from('place_skill_configs')
        .select('skill_id, enforce_min_team_rating, min_avg_rating')
        .eq('place_id', template.place_id)
        .in('skill_id', skillIdsInCoverage);

      if (placeSkillError) {
        // Keep backward compatibility for environments without the new table yet.
        if (!placeSkillError.message?.includes('does not exist') && placeSkillError.code !== '42P01') {
          console.error('Error fetching place skill configs:', placeSkillError);
        }
      } else {
        skillConstraints = (placeSkillConfigs || []).map((c: {
          skill_id: string;
          enforce_min_team_rating: boolean | null;
          min_avg_rating: number | null;
        }) => ({
          skill_id: c.skill_id,
          enforce_min_team_rating: c.enforce_min_team_rating ?? false,
          min_avg_rating: c.min_avg_rating ?? null,
        }));
      }
    }

    // Build unavailability from worker_availability calendar entries
    // Workers who have NO entry for a date are treated as unavailable (conservative).
    // Workers with 'unavailable' are fully off that day.
    // Workers with 'available_range' are unavailable outside that range.
    // Workers with 'available_all_day' have no unavailability for that day.
    const unavailability: SolverRequest['unavailability'] = [];

    Object.keys(workersMap).forEach(workerId => {
      const workerAvail = workerAvailMap[workerId] || {};

      (shiftTemplates || []).forEach((st) => {
        if (st.day_type === 'work') {
          const shiftDate = new Date(st.date + 'T00:00:00');
          const dayOffset = Math.round((shiftDate.getTime() - startDateObj.getTime()) / (24 * 60 * 60 * 1000));
          const dateStr = st.date; // YYYY-MM-DD
          const entry = workerAvail[dateStr];

          if (!entry || entry.type === 'unavailable') {
            // No availability set or explicitly unavailable → full day off
            unavailability.push({
              worker_id: workerId,
              day: dayOffset,
              is_full_day: true,
            });
          } else if (entry.type === 'available_range' && entry.start_time && entry.end_time) {
            // Available only during a range → unavailable outside that range
            const [aStartH, aStartM] = entry.start_time.split(':').map(Number);
            const [aEndH, aEndM] = entry.end_time.split(':').map(Number);
            const availStart = aStartH * 60 + (aStartM || 0);
            const availEnd = aEndH * 60 + (aEndM || 0);

            // Unavailable before their available start
            if (availStart > 0) {
              unavailability.push({
                worker_id: workerId,
                day: dayOffset,
                start_minutes: 0,
                end_minutes: availStart,
                is_full_day: false,
              });
            }
            // Unavailable after their available end
            if (availEnd < 1440) {
              unavailability.push({
                worker_id: workerId,
                day: dayOffset,
                start_minutes: availEnd,
                end_minutes: 1440,
                is_full_day: false,
              });
            }
          }
          // 'available_all_day' → no unavailability entry needed
        }
      });
    });

    // Prepare solver request
    const placeSettings = template.places?.settings || {};
    const solverRequest: SolverRequest = {
      place_id: template.place_id,
      start_date: template.start_date,
      end_date: template.end_date,
      workers: Object.values(workersMap),
      skill_constraints: skillConstraints,
      coverage_windows: coverageWindows,
      unavailability,
      settings: {
        max_hours_per_day: placeSettings.max_hours_per_day || 12,
        min_hours_per_block: placeSettings.min_hours_per_block || 2,
        max_hours_per_block: placeSettings.max_hours_per_block || 10,
        min_rest_between_shifts: placeSettings.min_rest_between_shifts || 8,
        granularity_minutes: placeSettings.schedule_granularity_minutes || 15
      }
    };

    // Update template status to processing
    await supabase
      .from('schedule_templates')
      .update({
        status: 'closed',
        solver_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', schedule_template_id);

    // Call solver
    let solverResult;
    try {
      const solverResponse = await fetch(`${SOLVER_URL}/solve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(solverRequest),
      });

      if (!solverResponse.ok) {
        throw new Error(`Solver returned ${solverResponse.status}`);
      }

      solverResult = await solverResponse.json();
    } catch (solverError) {
      console.error('Solver error:', solverError);
      
      // Update template with failure
      await supabase
        .from('schedule_templates')
        .update({
          solver_status: 'failed',
          solver_result: { error: 'Failed to connect to solver' },
          solver_processed_at: new Date().toISOString()
        })
        .eq('id', schedule_template_id);

      // Notify manager of failure
      await notifyManager(
        user.id,
        'Schedule Generation Failed',
        `Failed to generate schedule for "${template.name}". The solver service is unavailable. Please try again later.`,
        NOTIFICATION_TYPES.SCHEDULE_INFEASIBLE,
        {
          schedule_template_id,
          error: 'Solver service unavailable'
        }
      );

      return NextResponse.json({
        success: false,
        error: 'Failed to connect to solver service'
      });
    }

    // Process solver result
    const isInfeasible = solverResult.status === 'INFEASIBLE' || solverResult.coverage_gaps?.length > 0;

    // Update template with result
    await supabase
      .from('schedule_templates')
      .update({
        solver_status: isInfeasible ? 'failed' : 'completed',
        solver_result: solverResult,
        solver_processed_at: new Date().toISOString()
      })
      .eq('id', schedule_template_id);

    // Notify manager
    if (isInfeasible) {
      const gapCount = solverResult.coverage_gaps?.length || 0;
      await notifyManager(
        user.id,
        'Schedule Not Feasible',
        `The schedule for "${template.name}" could not be fully generated. ${gapCount} coverage gap${gapCount !== 1 ? 's' : ''} found. You may need to reopen the timesheet and ask workers to update their availability.`,
        NOTIFICATION_TYPES.SCHEDULE_INFEASIBLE,
        {
          schedule_template_id,
          coverage_gaps: solverResult.coverage_gaps,
          diagnostics: solverResult.diagnostics
        }
      );
    } else {
      await notifyManager(
        user.id,
        'Schedule Generated Successfully',
        `The schedule for "${template.name}" has been generated successfully with ${solverResult.assignments?.length || 0} assignments.`,
        NOTIFICATION_TYPES.SCHEDULE_CREATED,
        {
          schedule_template_id,
          assignments_count: solverResult.assignments?.length || 0,
          diagnostics: solverResult.diagnostics
        }
      );
    }

    console.log('Processed deadline for template:', {
      templateId: schedule_template_id,
      status: solverResult.status,
      assignments: solverResult.assignments?.length || 0,
      gaps: solverResult.coverage_gaps?.length || 0
    });

    return NextResponse.json({
      success: true,
      result: solverResult,
      is_feasible: !isInfeasible
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check for timesheets past deadline that need processing
export async function GET() {
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

    // Find published timesheets past their deadline that haven't been processed
    const { data: expiredTimesheets, error } = await supabase
      .from('schedule_templates')
      .select('id, name, manager_id, availability_deadline')
      .eq('status', 'published')
      .lt('availability_deadline', new Date().toISOString())
      .is('solver_status', null);

    if (error) {
      console.error('Error fetching expired timesheets:', error);
      return NextResponse.json(
        { error: 'Failed to fetch timesheets' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      expired_timesheets: expiredTimesheets || [],
      count: expiredTimesheets?.length || 0
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
