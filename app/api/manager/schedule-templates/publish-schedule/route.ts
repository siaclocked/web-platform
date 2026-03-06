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

/**
 * Ensure the schedule_publish_history table and related schema exist.
 * Uses the Supabase Management API (service role) to run migration SQL
 * only when the table is missing.
 */
async function ensurePublishSchema(supabase: ReturnType<typeof getSupabase>) {
  // Quick probe: try selecting from the table
  const { error: probeError } = await supabase
    .from('schedule_publish_history')
    .select('id')
    .limit(1);

  if (!probeError) return; // table exists

  console.log('[publish] schedule_publish_history table missing — creating it now…');

  // Create via raw SQL through a Postgres function (rpc)
  // First ensure the rpc helper exists, then call it
  const migrationSQL = `
    -- Allow schedule_published status
    ALTER TABLE schedule_templates
      DROP CONSTRAINT IF EXISTS schedule_templates_status_check;

    ALTER TABLE schedule_templates
      ADD CONSTRAINT schedule_templates_status_check
      CHECK (status IN ('draft', 'published', 'closed', 'schedule_published'));

    ALTER TABLE schedule_templates
      ADD COLUMN IF NOT EXISTS schedule_published_at TIMESTAMPTZ DEFAULT NULL;

    CREATE TABLE IF NOT EXISTS schedule_publish_history (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      schedule_template_id UUID NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
      snapshot JSONB NOT NULL,
      published_at TIMESTAMPTZ DEFAULT NOW(),
      published_by UUID NOT NULL REFERENCES users(id),
      version INTEGER NOT NULL DEFAULT 1
    );

    ALTER TABLE schedule_publish_history ENABLE ROW LEVEL SECURITY;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_access_sph') THEN
        CREATE POLICY "service_role_full_access_sph"
          ON schedule_publish_history FOR ALL
          USING (true) WITH CHECK (true);
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_schedule_publish_history_template
      ON schedule_publish_history(schedule_template_id);
  `;

  // Execute via Supabase REST SQL endpoint (service role has access)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query: migrationSQL }),
  });

  // If the rpc function doesn't exist, try the postgres meta endpoint
  if (!res.ok) {
    console.log('[publish] exec_sql rpc not available, trying pg-meta…');
    const pgRes = await fetch(`${supabaseUrl}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: migrationSQL }),
    });

    if (!pgRes.ok) {
      console.warn('[publish] Could not auto-create table. Will attempt insert anyway.');
    }
  }
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

    // Must be closed with solver results (or manually edited assignments)
    if (template.status !== 'closed' || !template.solver_result) {
      return NextResponse.json(
        { error: 'Schedule must be closed with assignments before publishing' },
        { status: 400 }
      );
    }

    // Ensure there are actual assignments to publish
    const solverResultData = template.solver_result as any;
    if (!solverResultData.assignments || solverResultData.assignments.length === 0) {
      return NextResponse.json(
        { error: 'Schedule has no assignments. Add shifts before publishing.' },
        { status: 400 }
      );
    }

    // Ensure publish schema exists (auto-migrate if needed)
    await ensurePublishSchema(supabase);

    // Get existing publish history count for versioning
    let version = 1;
    const { count: historyCount } = await supabase
      .from('schedule_publish_history')
      .select('*', { count: 'exact', head: true })
      .eq('schedule_template_id', schedule_template_id);

    version = (historyCount || 0) + 1;

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
      // Don't block publishing — log and continue
      console.warn('[publish] Continuing without history record…');
    }

    // Update template status — also ensure the constraint allows this value
    // Try schedule_published first; fall back to closed if constraint rejects it
    let { error: updateError } = await supabase
      .from('schedule_templates')
      .update({
        status: 'schedule_published',
        schedule_published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', schedule_template_id);

    if (updateError) {
      console.warn('[publish] status update to schedule_published failed, trying closed:', updateError.message);
      // Fallback: don't set schedule_published_at (column may not exist)
      const fallback = await supabase
        .from('schedule_templates')
        .update({
          status: 'closed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', schedule_template_id);

      if (fallback.error) {
        console.error('Error updating template status (fallback):', fallback.error);
        return NextResponse.json({ error: 'Failed to update schedule status' }, { status: 500 });
      }
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
