import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SOLVER_URL = process.env.SOLVER_SERVICE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { place_id, start_date, end_date, settings } = body;

    if (!place_id || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch workers for this place
    const { data: workerPlaces } = await supabase
      .from('worker_places')
      .select(`
        worker_id,
        users!inner (
          id,
          first_name,
          last_name
        )
      `)
      .eq('place_id', place_id)
      .eq('is_active', true);

    // Fetch worker skills
    const workerIds = workerPlaces?.map((wp) => wp.worker_id) || [];
    
    const { data: workerSkills } = await supabase
      .from('worker_skills')
      .select('worker_id, skill_id, rating')
      .in('worker_id', workerIds);

    // Build workers array for solver
    const workers = workerPlaces?.map((wp) => {
      const skills = workerSkills?.filter((ws) => ws.worker_id === wp.worker_id) || [];
      const userData = wp.users as unknown as { id: string; first_name: string; last_name: string } | null;
      
      return {
        id: wp.worker_id,
        name: userData ? `${userData.first_name} ${userData.last_name}` : 'Unknown',
        skill_ids: skills.map((s) => s.skill_id),
        place_ids: [place_id],
        skill_ratings: Object.fromEntries(
          skills.map((s) => [s.skill_id, s.rating])
        ),
      };
    }) || [];

    // Fetch coverage templates
    const { data: coverageTemplates } = await supabase
      .from('coverage_templates')
      .select('*')
      .eq('place_id', place_id);

    const coverage_windows = coverageTemplates?.map((ct) => ({
      id: ct.id,
      skill_id: ct.skill_id,
      day: ct.day_of_week,
      start_minutes: timeToMinutes(ct.start_time),
      end_minutes: timeToMinutes(ct.end_time),
      min_workers: ct.min_workers,
    })) || [];

    // Fetch unavailability
    const { data: availabilityData } = await supabase
      .from('availability')
      .select('*')
      .in('worker_id', workerIds)
      .gte('date', start_date)
      .lte('date', end_date);

    const unavailability = availabilityData?.map((a) => ({
      worker_id: a.worker_id,
      day: new Date(a.date).getDay(),
      start_minutes: a.start_time ? timeToMinutes(a.start_time) : null,
      end_minutes: a.end_time ? timeToMinutes(a.end_time) : null,
      is_full_day: a.type === 'full_day' || a.type === 'vacation',
    })) || [];

    // Fetch existing assignments if any
    const { data: existingSchedule } = await supabase
      .from('schedules')
      .select('id')
      .eq('place_id', place_id)
      .eq('status', 'PUBLISHED')
      .gte('end_date', start_date)
      .lte('start_date', end_date)
      .single();

    let existing_assignments: Array<{
      worker_id: string;
      skill_id: string;
      day: number;
      start_minutes: number;
      end_minutes: number;
      is_locked: boolean;
    }> = [];

    if (existingSchedule) {
      const { data: shifts } = await supabase
        .from('shifts')
        .select('*')
        .eq('schedule_id', existingSchedule.id);

      existing_assignments = shifts?.map((s) => ({
        worker_id: s.worker_id,
        skill_id: s.skill_id,
        day: new Date(s.start_time).getDay(),
        start_minutes: dateToMinutes(s.start_time),
        end_minutes: dateToMinutes(s.end_time),
        is_locked: s.is_locked,
      })) || [];
    }

    // Call solver service
    const solverRequest = {
      place_id,
      start_date,
      end_date,
      workers,
      coverage_windows,
      existing_assignments,
      unavailability,
      settings: settings || {
        max_hours_per_day: 12,
        min_hours_per_block: 2,
        max_hours_per_block: 10,
        min_rest_between_shifts: 8,
        granularity_minutes: 15,
      },
      minimize_changes: true,
      balance_hours: true,
    };

    const solverResponse = await fetch(`${SOLVER_URL}/solve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(solverRequest),
    });

    if (!solverResponse.ok) {
      const error = await solverResponse.text();
      return NextResponse.json(
        { error: `Solver error: ${error}` },
        { status: 500 }
      );
    }

    const solverResult = await solverResponse.json();

    // Create or update schedule draft
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .upsert(
        {
          place_id,
          start_date,
          end_date,
          status: 'DRAFT',
          created_by: user.id,
        },
        {
          onConflict: 'place_id,start_date,end_date',
        }
      )
      .select()
      .single();

    if (scheduleError) {
      console.error('Error creating schedule:', scheduleError);
    }

    // If schedule created, insert shifts
    if (schedule && solverResult.assignments) {
      // Delete existing draft shifts
      await supabase
        .from('shifts')
        .delete()
        .eq('schedule_id', schedule.id);

      // Insert new shifts
      const shifts = solverResult.assignments.map((a: {
        worker_id: string;
        skill_id: string;
        day: number;
        start_minutes: number;
        end_minutes: number;
      }) => ({
        schedule_id: schedule.id,
        worker_id: a.worker_id,
        place_id,
        skill_id: a.skill_id,
        start_time: minutesToDate(start_date, a.day, a.start_minutes),
        end_time: minutesToDate(start_date, a.day, a.end_minutes),
        is_locked: false,
        is_open: false,
      }));

      if (shifts.length > 0) {
        await supabase.from('shifts').insert(shifts);
      }
    }

    return NextResponse.json({
      ...solverResult,
      schedule_id: schedule?.id,
    });
  } catch (error) {
    console.error('Error solving schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function dateToMinutes(dateStr: string): number {
  const date = new Date(dateStr);
  return date.getHours() * 60 + date.getMinutes();
}

function minutesToDate(startDate: string, dayOffset: number, minutes: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toISOString();
}
