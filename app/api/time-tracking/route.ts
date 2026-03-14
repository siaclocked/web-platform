import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  try {
    // Auth via cookie client
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role for data queries (bypasses RLS)
    const supabase = getServiceSupabase();

    // Get active session
    const { data: activeSession } = await supabase
      .from('work_sessions')
      .select(`
        *,
        places (name),
        skills (name)
      `)
      .eq('worker_id', user.id)
      .is('end_time', null)
      .single();

    // Get worker's assigned places
    const { data: workerPlaces, error: wpError } = await supabase
      .from('worker_places')
      .select('place_id, places:place_id (id, name)')
      .eq('worker_id', user.id)
      .eq('is_active', true);

    if (wpError) {
      console.error('Error fetching worker places:', wpError);
    }

    const places = (workerPlaces || []).map((wp: any) => ({
      id: wp.places?.id || wp.place_id,
      name: wp.places?.name || 'Unknown',
    }));

    return NextResponse.json({ active_session: activeSession, places });
  } catch (error) {
    console.error('Error fetching time tracking:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth via cookie client
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role for data queries
    const supabase = getServiceSupabase();

    const body = await request.json();
    const { action, place_id, skill_id, handoff_note, handoff_audience } = body;

    if (action === 'start') {
      if (!place_id) {
        return NextResponse.json(
          { error: 'Missing place_id' },
          { status: 400 }
        );
      }

      // Check for existing active session
      const { data: existing } = await supabase
        .from('work_sessions')
        .select('id')
        .eq('worker_id', user.id)
        .is('end_time', null)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'Already have an active session' },
          { status: 400 }
        );
      }

      // Check if there's a scheduled shift for this worker at this place
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const EARLY_MARGIN = 15; // Worker can clock in 15 min early

      // Get worker's company_id
      const { data: workerData } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      // Find published schedules that include today and this place
      let isScheduled = false;
      let matchedShiftEnd: number | null = null;

      if (workerData) {
        const { data: templates } = await supabase
          .from('schedule_templates')
          .select('id, start_date, end_date, solver_result, place_id')
          .eq('company_id', workerData.company_id)
          .eq('place_id', place_id)
          .in('status', ['schedule_published', 'closed'])
          .lte('start_date', todayStr)
          .gte('end_date', todayStr);

        if (templates && templates.length > 0) {
          for (const template of templates) {
            const result = template.solver_result as any;
            if (!result?.assignments) continue;

            const startDate = new Date(template.start_date + 'T00:00:00');
            const dayOffset = Math.round(
              (new Date(todayStr + 'T00:00:00').getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
            );

            const workerShifts = result.assignments.filter(
              (a: any) => a.worker_id === user.id && a.day === dayOffset
            );

            for (const shift of workerShifts) {
              // Allow clock-in up to 15 min before shift start, and anytime during shift
              if (currentMinutes >= shift.start_minutes - EARLY_MARGIN && currentMinutes <= shift.end_minutes) {
                isScheduled = true;
                matchedShiftEnd = shift.end_minutes;
                break;
              }
            }
            if (isScheduled) break;
          }

          // If no matching shift found, reject clock-in
          if (!isScheduled) {
            return NextResponse.json(
              { error: 'You do not have a scheduled shift at this location right now. You can clock in up to 15 minutes before your shift starts.' },
              { status: 400 }
            );
          }
        } else {
          // No published schedules exist for this place/date — still require a shift
          return NextResponse.json(
            { error: 'No schedule has been published for this location yet. Please wait until your manager publishes a schedule.' },
            { status: 400 }
          );
        }
      }

      // Create work session
      const { data: session, error } = await supabase
        .from('work_sessions')
        .insert({
          worker_id: user.id,
          place_id,
          skill_id: skill_id || null,
          start_time: now.toISOString(),
          is_scheduled: isScheduled,
          scheduled_end_minutes: matchedShiftEnd,
        })
        .select()
        .single();

      if (error) {
        // If scheduled_end_minutes column doesn't exist yet, retry without it
        if (error.message?.includes('scheduled_end_minutes')) {
          const { data: session2, error: error2 } = await supabase
            .from('work_sessions')
            .insert({
              worker_id: user.id,
              place_id,
              skill_id: skill_id || null,
              start_time: now.toISOString(),
              is_scheduled: isScheduled,
            })
            .select()
            .single();

          if (error2) {
            return NextResponse.json(
              { error: 'Failed to start session' },
              { status: 500 }
            );
          }
          return NextResponse.json({ session: session2 });
        }

        return NextResponse.json(
          { error: 'Failed to start session' },
          { status: 500 }
        );
      }

      return NextResponse.json({ session });
    }

    if (action === 'stop') {
      // Find active session
      const { data: session, error: fetchError } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('worker_id', user.id)
        .is('end_time', null)
        .single();

      if (fetchError || !session) {
        return NextResponse.json(
          { error: 'No active session found' },
          { status: 400 }
        );
      }

      // Update session
      const { error: updateError } = await supabase
        .from('work_sessions')
        .update({
          end_time: new Date().toISOString(),
          handoff_note: handoff_note || null,
          handoff_audience: handoff_audience || null,
        })
        .eq('id', session.id);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to stop session' },
          { status: 500 }
        );
      }

      // If handoff note, notify next workers
      if (handoff_note && handoff_audience) {
        await sendHandoffNotifications(
          supabase,
          session.place_id,
          session.skill_id,
          handoff_note,
          handoff_audience,
          user.id
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in time tracking:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function sendHandoffNotifications(
  supabase: ReturnType<typeof getServiceSupabase>,
  placeId: string,
  skillId: string,
  note: string,
  audience: string,
  fromUserId: string
) {
  const now = new Date();
  const nextHours = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  // Find next shifts
  let query = supabase
    .from('shifts')
    .select('worker_id')
    .eq('place_id', placeId)
    .gte('start_time', now.toISOString())
    .lte('start_time', nextHours.toISOString())
    .neq('worker_id', fromUserId);

  if (audience === 'NEXT_IN_SKILL') {
    query = query.eq('skill_id', skillId);
  }

  const { data: nextShifts } = await query;

  if (nextShifts && nextShifts.length > 0) {
    const workerIds = [...new Set(nextShifts.map((s) => s.worker_id))];
    
    const notifications = workerIds.map((workerId) => ({
      user_id: workerId,
      title: 'Handoff Note',
      message: note,
      type: 'handoff',
      metadata: { place_id: placeId, skill_id: skillId },
    }));

    await supabase.from('notifications').insert(notifications);
  }
}
