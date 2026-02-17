import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createBulkNotifications, NOTIFICATION_TYPES } from '@/lib/notifications';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase();

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { schedule_template_id } = await request.json();
    if (!schedule_template_id) {
      return NextResponse.json({ error: 'schedule_template_id is required' }, { status: 400 });
    }

    // Fetch the schedule template
    const { data: template, error: fetchError } = await supabase
      .from('schedule_templates')
      .select('*')
      .eq('id', schedule_template_id)
      .eq('manager_id', user.id)
      .single();

    if (fetchError || !template) {
      return NextResponse.json({ error: 'Schedule not found or access denied' }, { status: 404 });
    }

    // Must be closed with solver results
    if (template.status !== 'closed' || template.solver_status !== 'completed' || !template.solver_result) {
      return NextResponse.json(
        { error: 'Schedule must be generated (closed with solver results) before publishing' },
        { status: 400 }
      );
    }

    // Get existing publish history count for versioning
    const { count: historyCount } = await supabase
      .from('schedule_publish_history')
      .select('*', { count: 'exact', head: true })
      .eq('schedule_template_id', schedule_template_id);

    const version = (historyCount || 0) + 1;

    // Create immutable snapshot
    const snapshot = {
      template_id: template.id,
      name: template.name,
      place_id: template.place_id,
      start_date: template.start_date,
      end_date: template.end_date,
      solver_result: template.solver_result,
      solver_processed_at: template.solver_processed_at,
      published_at: new Date().toISOString(),
      version,
    };

    const { error: historyError } = await supabase
      .from('schedule_publish_history')
      .insert({
        schedule_template_id,
        snapshot,
        published_by: user.id,
        version,
      });

    if (historyError) {
      console.error('Error creating publish history:', historyError);
      return NextResponse.json({ error: 'Failed to create history record' }, { status: 500 });
    }

    // Update template status
    const { error: updateError } = await supabase
      .from('schedule_templates')
      .update({
        status: 'schedule_published',
        schedule_published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', schedule_template_id);

    if (updateError) {
      console.error('Error updating template status:', updateError);
      return NextResponse.json({ error: 'Failed to update schedule status' }, { status: 500 });
    }

    // Notify affected workers
    const solverResult = template.solver_result as any;
    const workerIds: string[] = [...new Set((solverResult?.assignments || []).map((a: any) => a.worker_id))] as string[];

    if (workerIds.length > 0) {
      await createBulkNotifications({
        userIds: workerIds,
        type: NOTIFICATION_TYPES.SCHEDULE_PUBLISHED,
        title: 'New Schedule Published',
        message: `A new schedule "${template.name}" has been published for ${template.start_date} to ${template.end_date}. Check your schedule for your assigned shifts.`,
        metadata: {
          schedule_template_id,
          start_date: template.start_date,
          end_date: template.end_date,
        },
      });
    }

    return NextResponse.json({
      success: true,
      version,
      workers_notified: workerIds.length,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
