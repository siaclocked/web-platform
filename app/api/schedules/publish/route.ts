import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const { schedule_id } = body;

    if (!schedule_id) {
      return NextResponse.json(
        { error: 'Missing schedule_id' },
        { status: 400 }
      );
    }

    // Get the schedule
    const { data: schedule, error: fetchError } = await supabase
      .from('schedules')
      .select('*, shifts(*)')
      .eq('id', schedule_id)
      .single();

    if (fetchError || !schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Save to history
    await supabase.from('schedule_history').insert({
      schedule_id,
      snapshot: schedule,
      published_by: user.id,
    });

    // Update schedule status
    const { error: updateError } = await supabase
      .from('schedules')
      .update({
        status: 'PUBLISHED',
        published_at: new Date().toISOString(),
      })
      .eq('id', schedule_id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to publish schedule' },
        { status: 500 }
      );
    }

    // Get affected workers
    const workerIds = [...new Set(schedule.shifts?.map((s: { worker_id: string }) => s.worker_id) || [])];

    // Send notifications to affected workers
    if (workerIds.length > 0) {
      const notifications = workerIds.map((workerId) => ({
        user_id: workerId,
        title: 'Schedule Published',
        message: `A new schedule has been published for ${schedule.start_date} - ${schedule.end_date}`,
        type: 'schedule',
        metadata: { schedule_id },
      }));

      await supabase.from('notifications').insert(notifications);
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule published successfully',
      notified_workers: workerIds.length,
    });
  } catch (error) {
    console.error('Error publishing schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
