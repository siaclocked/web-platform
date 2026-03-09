import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createBulkNotifications, NOTIFICATION_TYPES } from '@/lib/notifications';
import { buildSolverRequest } from '../solver-payload';

const SOLVER_URL = process.env.SOLVER_URL || 'http://localhost:8000';

type ScheduleAssignment = {
  worker_id: string;
  skill_id: string;
  day: number;
  start_minutes: number;
  end_minutes: number;
  is_locked?: boolean;
};

type SolverResultShape = {
  assignments?: ScheduleAssignment[];
  diagnostics?: string[];
  coverage_gaps?: unknown[];
  constraint_violations?: unknown[];
  total_hours_by_worker?: Record<string, number>;
};

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

    const body = await request.json();
    const { schedule_template_id } = body;
    const assignments = Array.isArray(body.assignments) ? body.assignments : [];

    if (!schedule_template_id) {
      return NextResponse.json({ error: 'schedule_template_id is required' }, { status: 400 });
    }

    // Fetch the template to verify ownership and get current solver_result
    const { data: template, error: fetchError } = await supabase
      .from('schedule_templates')
      .select(`
        *,
        places:place_id (
          settings
        )
      `)
      .eq('id', schedule_template_id)
      .eq('manager_id', user.id)
      .single();

    if (fetchError || !template) {
      return NextResponse.json({ error: 'Schedule not found or access denied' }, { status: 404 });
    }

    // Must have solver results (closed or published)
    if (!template.solver_result) {
      return NextResponse.json(
        { error: 'Schedule must have solver results before editing' },
        { status: 400 }
      );
    }

    // Get previous worker IDs before edit
    const prevWorkerIds = new Set<string>(
      ((template.solver_result as SolverResultShape | null)?.assignments || []).map((assignment) => assignment.worker_id)
    );

    const { data: shiftTemplates, error: shiftsError } = await supabase
      .from('shift_templates')
      .select('*')
      .eq('schedule_template_id', schedule_template_id)
      .order('date', { ascending: true });

    if (shiftsError) {
      return NextResponse.json({ error: 'Failed to load schedule structure for validation' }, { status: 500 });
    }

    const editedAssignments = (assignments as ScheduleAssignment[]).map((assignment) => ({
      worker_id: assignment.worker_id,
      skill_id: assignment.skill_id,
      day: assignment.day,
      start_minutes: assignment.start_minutes,
      end_minutes: assignment.end_minutes,
      is_locked: assignment.is_locked ?? true,
    }));

    const solverRequest = await buildSolverRequest({
      supabase,
      template: template,
      shiftTemplates: (shiftTemplates || []) as Array<{
        id: string;
        date: string;
        day_type: string;
        shifts: Array<{ startTime: string; endTime: string; position: string; workers?: number }> | null;
      }>,
      existingAssignmentsOverride: editedAssignments,
      minimizeChanges: true,
      balanceHours: true,
    });

    const validateResponse = await fetch(`${SOLVER_URL}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(solverRequest),
    });

    if (!validateResponse.ok) {
      return NextResponse.json({ error: 'Failed to validate edited schedule' }, { status: 502 });
    }

    const validationResult = await validateResponse.json();

    const updatedResult = {
      ...template.solver_result,
      assignments,
      coverage_gaps: validationResult.coverage_gaps || [],
      diagnostics: [
        ...(validationResult.diagnostics || []),
        `Manually edited by manager (${assignments.length} shifts)`,
      ],
      constraint_violations: validationResult.constraint_violations || [],
      total_hours_by_worker: validationResult.total_hours_by_worker || {},
      validation_status: validationResult.is_valid ? 'VALID' : 'INVALID',
      manual_locked_assignments: editedAssignments.filter((assignment) => assignment.is_locked),
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

    // If the schedule is already published, notify affected workers about the change
    if (template.status === 'schedule_published') {
      const newWorkerIds = new Set<string>((assignments as ScheduleAssignment[]).map((assignment) => assignment.worker_id));
      // Notify all workers who are in the new or old assignments
      const allAffectedIds = [...new Set([...prevWorkerIds, ...newWorkerIds])];

      if (allAffectedIds.length > 0) {
        await createBulkNotifications({
          userIds: allAffectedIds,
          type: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
          title: 'Schedule Updated',
          message: `Your schedule "${template.name}" (${template.start_date} to ${template.end_date}) has been updated by your manager. Please check your schedule for changes.`,
          metadata: {
            schedule_template_id,
            start_date: template.start_date,
            end_date: template.end_date,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      is_valid: validationResult.is_valid,
      assignments_count: assignments.length,
      total_hours_by_worker: validationResult.total_hours_by_worker || {},
      coverage_gaps: validationResult.coverage_gaps || [],
      constraint_violations: validationResult.constraint_violations || [],
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
