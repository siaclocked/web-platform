import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { 
  notifyWorkersAtPlace, 
  NOTIFICATION_TYPES,
  formatTimesheetNotificationMessage 
} from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Schedule template ID is required' },
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

    // Get the schedule template with place info
    const { data: template, error: fetchError } = await supabase
      .from('schedule_templates')
      .select(`
        *,
        places:place_id (
          id,
          name
        )
      `)
      .eq('id', id)
      .eq('manager_id', user.id)
      .single();

    if (fetchError || !template) {
      return NextResponse.json(
        { error: 'Schedule template not found or you do not have permission' },
        { status: 404 }
      );
    }

    if (template.status === 'published') {
      return NextResponse.json(
        { error: 'This timesheet is already published' },
        { status: 400 }
      );
    }

    if (template.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot publish a closed timesheet' },
        { status: 400 }
      );
    }

    // Check if deadline is in the future
    const deadline = new Date(template.availability_deadline);
    if (deadline <= new Date()) {
      return NextResponse.json(
        { error: 'Cannot publish a timesheet with a past deadline. Please update the deadline first.' },
        { status: 400 }
      );
    }

    // Update the template status to published
    const { data: updatedTemplate, error: updateError } = await supabase
      .from('schedule_templates')
      .update({
        status: 'published',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error publishing template:', updateError);
      return NextResponse.json(
        { error: 'Failed to publish timesheet' },
        { status: 500 }
      );
    }

    // First, check how many workers are assigned to this place
    const { data: workersAtPlace, error: workersError } = await supabase
      .from('worker_places')
      .select('worker_id')
      .eq('place_id', template.place_id)
      .eq('is_active', true);

    console.log('Workers at place check:', {
      placeId: template.place_id,
      workersFound: workersAtPlace?.length || 0,
      error: workersError?.message
    });

    // Notify all workers at this place
    const placeName = template.places?.name || 'Unknown Place';
    const message = formatTimesheetNotificationMessage(
      template.name,
      placeName,
      template.start_date,
      template.end_date,
      template.availability_deadline
    );

    const notifyResult = await notifyWorkersAtPlace(
      template.place_id,
      'New Timesheet Available',
      message,
      NOTIFICATION_TYPES.TIMESHEET_PUBLISHED,
      {
        schedule_template_id: id,
        place_id: template.place_id,
        place_name: placeName,
        start_date: template.start_date,
        end_date: template.end_date,
        deadline: template.availability_deadline
      }
    );

    console.log('Published timesheet and notified workers:', {
      templateId: id,
      templateName: template.name,
      placeId: template.place_id,
      placeName: placeName,
      workersAtPlace: workersAtPlace?.length || 0,
      notificationsResult: notifyResult
    });

    return NextResponse.json({
      success: true,
      template: updatedTemplate,
      notifications_sent: notifyResult.count
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
