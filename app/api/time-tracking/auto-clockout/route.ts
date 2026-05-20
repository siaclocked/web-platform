import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// POST: Auto clock-out workers whose shift has ended + 15 min grace
// This can be called by a cron job or triggered client-side
export async function POST() {
  try {
    const supabase = getServiceSupabase();
    const AUTO_CLOCKOUT_GRACE = 15; // minutes after shift end

    // Find all active sessions (no end_time)
    const { data: activeSessions, error } = await supabase
      .from('work_sessions')
      .select('id, worker_id, place_id, start_time, scheduled_end_minutes')
      .is('end_time', null);

    if (error) {
      console.error('Error fetching active sessions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!activeSessions || activeSessions.length === 0) {
      return NextResponse.json({ auto_clocked_out: 0 });
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let autoClockOutCount = 0;

    for (const session of activeSessions) {
      let shouldAutoClockOut = false;
      let endMinutes = session.scheduled_end_minutes;

      // If we have a scheduled end time stored on the session
      if (endMinutes !== null && endMinutes !== undefined) {
        if (currentMinutes >= endMinutes + AUTO_CLOCKOUT_GRACE) {
          shouldAutoClockOut = true;
        }
      } else {
        // Try to find shift from published schedules
        const { data: workerData } = await supabase
          .from('users')
          .select('company_id')
          .eq('id', session.worker_id)
          .single();

        if (workerData) {
          const todayStr = now.toISOString().split('T')[0];
          const { data: templates } = await supabase
            .from('schedule_templates')
            .select('id, start_date, end_date, solver_result')
            .eq('company_id', workerData.company_id)
            .eq('place_id', session.place_id)
            .in('status', ['schedule_published', 'closed'])
            .lte('start_date', todayStr)
            .gte('end_date', todayStr);

          if (templates) {
            for (const template of templates) {
              const result = template.solver_result as any;
              if (!result?.assignments) continue;

              const startDate = new Date(template.start_date + 'T00:00:00');
              const dayOffset = Math.round(
                (new Date(todayStr + 'T00:00:00').getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
              );

              const workerShifts = result.assignments.filter(
                (a: any) => a.worker_id === session.worker_id && a.day === dayOffset
              );

              for (const shift of workerShifts) {
                if (currentMinutes >= shift.end_minutes + AUTO_CLOCKOUT_GRACE) {
                  shouldAutoClockOut = true;
                  endMinutes = shift.end_minutes;
                  break;
                }
              }
              if (shouldAutoClockOut) break;
            }
          }
        }
      }

      if (shouldAutoClockOut && endMinutes !== null && endMinutes !== undefined) {
        // Auto clock-out at shift end time (not current time)
        const sessionStart = new Date(session.start_time);
        const autoEndTime = new Date(sessionStart);
        autoEndTime.setHours(0, 0, 0, 0);
        autoEndTime.setMinutes(endMinutes);

        // Ensure auto end time is after start time
        if (autoEndTime.getTime() <= sessionStart.getTime()) {
          autoEndTime.setTime(now.getTime()); // Fallback to now
        }

        const { error: updateError } = await supabase
          .from('work_sessions')
          .update({
            end_time: autoEndTime.toISOString(),
            status: 'auto_closed',
            handoff_note: 'Auto clocked out (shift ended)',
          })
          .eq('id', session.id);

        if (!updateError) {
          autoClockOutCount++;
        } else {
          console.error(`Failed to auto clock-out session ${session.id}:`, updateError);
        }
      }
    }

    return NextResponse.json({
      auto_clocked_out: autoClockOutCount,
      checked: activeSessions.length,
    });
  } catch (err) {
    console.error('Auto clock-out error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
