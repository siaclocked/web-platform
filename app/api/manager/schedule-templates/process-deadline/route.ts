import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { 
  notifyManager, 
  NOTIFICATION_TYPES 
} from '@/lib/notifications';
import { buildSolverRequest } from '../solver-payload';

const SOLVER_URL = process.env.SOLVER_URL || 'http://localhost:8000';

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
      process.env.SUPABASE_SECRET_KEY!,
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

    const solverRequest = await buildSolverRequest({
      supabase,
      template,
      shiftTemplates: (shiftTemplates || []) as Array<{
        id: string;
        date: string;
        day_type: string;
        shifts: Array<{ startTime: string; endTime: string; position: string; workers?: number }> | null;
      }>,
      minimizeChanges: true,
      balanceHours: true,
    });

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
    const isInfeasible =
      solverResult.status === 'INFEASIBLE' ||
      solverResult.coverage_gaps?.length > 0 ||
      solverResult.constraint_violations?.length > 0;

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
      process.env.SUPABASE_SECRET_KEY!,
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
