import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

interface AvailabilitySubmission {
  schedule_template_id: string;
  shift_template_id: string;
  shift_index: number;
  is_available: boolean;
}

export async function POST(request: Request) {
  try {
    const { submissions } = await request.json() as { submissions: AvailabilitySubmission[] };

    if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
      return NextResponse.json(
        { error: 'Submissions array is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get current user from session
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

    // Verify that all schedule templates are published and deadline hasn't passed
    const scheduleTemplateIds = [...new Set(submissions.map(s => s.schedule_template_id))];
    
    const { data: templates, error: templatesError } = await supabase
      .from('schedule_templates')
      .select('id, status, availability_deadline, place_id')
      .in('id', scheduleTemplateIds);

    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
      return NextResponse.json(
        { error: 'Failed to verify timesheets' },
        { status: 500 }
      );
    }

    // Validate all templates
    const now = new Date();
    for (const template of templates || []) {
      if (template.status !== 'published') {
        return NextResponse.json(
          { error: 'Cannot submit availability for unpublished timesheet' },
          { status: 400 }
        );
      }

      const deadline = new Date(template.availability_deadline);
      if (deadline <= now) {
        return NextResponse.json(
          { error: 'The deadline for this timesheet has passed' },
          { status: 400 }
        );
      }
    }

    // Verify worker is assigned to the places
    const placeIds = [...new Set(templates?.map(t => t.place_id) || [])];
    const { data: workerPlaces, error: placesError } = await supabase
      .from('worker_places')
      .select('place_id')
      .eq('worker_id', user.id)
      .eq('is_active', true)
      .in('place_id', placeIds);

    if (placesError) {
      console.error('Error fetching worker places:', placesError);
      return NextResponse.json(
        { error: 'Failed to verify worker assignment' },
        { status: 500 }
      );
    }

    const workerPlaceIds = workerPlaces?.map(wp => wp.place_id) || [];
    for (const template of templates || []) {
      if (!workerPlaceIds.includes(template.place_id)) {
        return NextResponse.json(
          { error: 'You are not assigned to this place' },
          { status: 403 }
        );
      }
    }

    // Prepare upsert data
    const upsertData = submissions.map(sub => ({
      schedule_template_id: sub.schedule_template_id,
      worker_id: user.id,
      shift_template_id: sub.shift_template_id,
      shift_index: sub.shift_index,
      is_available: sub.is_available,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Upsert submissions (insert or update on conflict)
    const { error: upsertError } = await supabase
      .from('worker_availability_submissions')
      .upsert(upsertData, {
        onConflict: 'schedule_template_id,worker_id,shift_template_id,shift_index'
      });

    if (upsertError) {
      console.error('Error upserting submissions:', upsertError);
      if (upsertError.code === '42P01' || upsertError.message.includes('does not exist')) {
        return NextResponse.json(
          { error: 'worker_availability_submissions table not found. Please run migration 016_worker_availability_submissions.sql.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: upsertError.message, code: upsertError.code },
        { status: 500 }
      );
    }

    console.log('Saved availability submissions:', {
      workerId: user.id,
      count: submissions.length,
      scheduleTemplateIds
    });

    return NextResponse.json({
      success: true,
      message: `Saved ${submissions.length} availability selections`
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get current user from session
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

    const { searchParams } = new URL(request.url);
    const scheduleTemplateId = searchParams.get('schedule_template_id');

    let query = supabase
      .from('worker_availability_submissions')
      .select('*')
      .eq('worker_id', user.id);

    if (scheduleTemplateId) {
      query = query.eq('schedule_template_id', scheduleTemplateId);
    }

    const { data: submissions, error } = await query;

    if (error) {
      console.error('Error fetching submissions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch availability' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      submissions: submissions || []
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
