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

      // Check if there's a scheduled shift nearby
      const now = new Date();
      const graceMinutes = 15;
      const windowStart = new Date(now.getTime() - graceMinutes * 60 * 1000);
      const windowEnd = new Date(now.getTime() + graceMinutes * 60 * 1000);

      let shiftQuery = supabase
        .from('shifts')
        .select('id')
        .eq('worker_id', user.id)
        .eq('place_id', place_id)
        .gte('start_time', windowStart.toISOString())
        .lte('start_time', windowEnd.toISOString());

      if (skill_id) {
        shiftQuery = shiftQuery.eq('skill_id', skill_id);
      }

      const { data: nearbyShift } = await shiftQuery.single();

      // Create work session
      const { data: session, error } = await supabase
        .from('work_sessions')
        .insert({
          worker_id: user.id,
          place_id,
          skill_id: skill_id || null,
          shift_id: nearbyShift?.id || null,
          start_time: now.toISOString(),
          is_scheduled: !!nearbyShift,
        })
        .select()
        .single();

      if (error) {
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
