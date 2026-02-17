import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { schedule_template_id, assignments } = await request.json();

    if (!schedule_template_id || !assignments) {
      return NextResponse.json({ error: 'schedule_template_id and assignments are required' }, { status: 400 });
    }

    // Fetch the template to verify ownership and get current solver_result
    const { data: template, error: fetchError } = await supabase
      .from('schedule_templates')
      .select('*')
      .eq('id', schedule_template_id)
      .eq('manager_id', user.id)
      .single();

    if (fetchError || !template) {
      return NextResponse.json({ error: 'Schedule not found or access denied' }, { status: 404 });
    }

    // Must be closed (solver completed) — not yet published
    if (template.solver_status !== 'completed' || !template.solver_result) {
      return NextResponse.json(
        { error: 'Schedule must have solver results before editing' },
        { status: 400 }
      );
    }

    // Rebuild total_hours_by_worker from new assignments
    const totalHours: Record<string, number> = {};
    for (const a of assignments) {
      const hours = (a.end_minutes - a.start_minutes) / 60;
      totalHours[a.worker_id] = (totalHours[a.worker_id] || 0) + hours;
    }

    // Update solver_result with new assignments
    const updatedResult = {
      ...template.solver_result,
      assignments,
      total_hours_by_worker: totalHours,
      diagnostics: [
        ...(template.solver_result.diagnostics || []),
        `Manually edited by manager (${assignments.length} shifts)`,
      ],
    };

    const { error: updateError } = await supabase
      .from('schedule_templates')
      .update({
        solver_result: updatedResult,
        updated_at: new Date().toISOString(),
      })
      .eq('id', schedule_template_id);

    if (updateError) {
      console.error('Error updating assignments:', updateError);
      return NextResponse.json({ error: 'Failed to save changes' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      assignments_count: assignments.length,
      total_hours_by_worker: totalHours,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
