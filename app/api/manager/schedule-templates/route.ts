import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Create service role client to bypass RLS for data access
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

    // Get user from session token in request
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get manager's company
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get schedule templates
    const { data: templates, error } = await supabase
      .from('schedule_templates')
      .select('*')
      .eq('manager_id', user.id)
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      // If table doesn't exist, return empty array
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('Schedule templates table does not exist yet');
        return NextResponse.json({ 
          templates: [] 
        });
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Get shift templates for each schedule template
    const templatesWithShifts = await Promise.all(
      (templates || []).map(async (template) => {
        console.log('Fetching shifts for template:', template.id);
        
        const { data: shifts, error: shiftsError } = await supabase
          .from('shift_templates')
          .select('*')
          .eq('schedule_template_id', template.id)
          .order('date', { ascending: true });

        console.log('Shifts query result for template', template.id, { shifts, shiftsError });

        if (shiftsError) {
          console.error('Error fetching shifts for template:', template.id, shiftsError);
          return {
            ...template,
            availability_deadline: template.availability_deadline ? 
              new Date(template.availability_deadline).toLocaleString('en-CA', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              }).replace(',', '') : '',
            shifts: []
          };
        }

        console.log('Returning template with shifts:', {
          templateId: template.id,
          shiftsCount: shifts?.length || 0,
          shifts: shifts
        });

        return {
          ...template,
          availability_deadline: template.availability_deadline ? 
            new Date(template.availability_deadline).toLocaleString('en-CA', { 
              year: 'numeric', 
              month: '2-digit', 
              day: '2-digit', 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            }).replace(',', '') : '',
          shifts: shifts || []
        };
      })
    );

    return NextResponse.json({ 
      templates: templatesWithShifts 
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, placeId, startDate, endDate, availabilityDeadline, status, shifts } = await request.json();

    if (!name?.trim() || !placeId || !startDate || !endDate || !availabilityDeadline) {
      return NextResponse.json(
        { error: 'Name, place, start date, end date, and availability deadline are required' },
        { status: 400 }
      );
    }

    // Create service role client to bypass RLS
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

    // Get current user from session
    let user = null;
    let authError = null;

    // Method 1: Check Authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const result = await supabase.auth.getUser(token);
      user = result.data.user;
      authError = result.error;
    }

    // Method 2: If no header, try to get from cookies (for client-side requests)
    if (!user && !authError) {
      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser();
      user = cookieUser;
      authError = cookieError;
    }

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get manager's company
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create schedule template
    const { data: template, error: templateError } = await supabase
      .from('schedule_templates')
      .insert({
        company_id: userData.company_id,
        manager_id: user.id,
        place_id: placeId,
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        availability_deadline: availabilityDeadline ? new Date(availabilityDeadline).toISOString() : null,
        status: status || 'draft',
      })
      .select()
      .single();

    if (templateError) {
      console.error('Database error:', templateError);
      // If table doesn't exist, provide a helpful error
      if (templateError.message.includes('does not exist') || templateError.code === '42P01') {
        return NextResponse.json(
          { error: 'Schedule templates table not found. Please run the database migration first.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: templateError.message },
        { status: 500 }
      );
    }

    // Create shift templates if provided
    if (shifts && shifts.length > 0) {
      console.log('Creating shift templates:', shifts);
      console.log('Shift data structure being saved:', JSON.stringify(shifts, null, 2));
      
      const shiftData = shifts.map((shift: any) => ({
        schedule_template_id: template.id,
        date: shift.date,
        day_type: shift.dayType,
        shifts: shift.shifts || []
      }));

      console.log('Final shift data for database:', JSON.stringify(shiftData, null, 2));

      const { error: shiftsError } = await supabase
        .from('shift_templates')
        .insert(shiftData);

      if (shiftsError) {
        console.error('Error creating shift templates:', shiftsError);
      } else {
        console.log('Shift templates created successfully');
      }
    } else {
      console.log('No shifts provided or shifts array is empty');
    }

    return NextResponse.json({ 
      success: true, 
      template: {
        ...template,
        shifts: shifts || []
      }
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, placeId, startDate, endDate, availabilityDeadline, status, shifts } = await request.json();

    if (!id || !name?.trim() || !placeId || !startDate || !endDate || !availabilityDeadline) {
      return NextResponse.json(
        { error: 'ID, name, place, start date, end date, and availability deadline are required' },
        { status: 400 }
      );
    }

    // Create service role client to bypass RLS
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

    // Get current user from session
    let user = null;
    let authError = null;

    // Method 1: Check Authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const result = await supabase.auth.getUser(token);
      user = result.data.user;
      authError = result.error;
    }

    // Method 2: If no header, try to get from cookies (for client-side requests)
    if (!user && !authError) {
      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser();
      user = cookieUser;
      authError = cookieError;
    }

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Update schedule template
    const { data: template, error: templateError } = await supabase
      .from('schedule_templates')
      .update({
        name: name.trim(),
        place_id: placeId,
        start_date: startDate,
        end_date: endDate,
        availability_deadline: availabilityDeadline ? new Date(availabilityDeadline).toISOString() : null,
        status: status || 'draft',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('manager_id', user.id) // Ensure user owns this template
      .select()
      .single();

    if (templateError) {
      console.error('Database error:', templateError);
      return NextResponse.json(
        { error: templateError.message },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        { error: 'Schedule template not found or you do not have permission to update it' },
        { status: 404 }
      );
    }

    // Delete existing shift templates and create new ones
    if (shifts) {
      // Delete existing shifts
      const { error: deleteError } = await supabase
        .from('shift_templates')
        .delete()
        .eq('schedule_template_id', id);

      if (deleteError) {
        console.error('Error deleting existing shift templates:', deleteError);
      }

      // Create new shift templates
      if (shifts.length > 0) {
        const shiftData = shifts.map((shift: any) => ({
          schedule_template_id: template.id,
          date: shift.date,
          day_type: shift.dayType,
          shifts: shift.shifts || []
        }));

        const { error: shiftsError } = await supabase
          .from('shift_templates')
          .insert(shiftData);

        if (shiftsError) {
          console.error('Error creating shift templates:', shiftsError);
        }
      }
    }

    console.log('Schedule template updated successfully:', { templateId: template.id, managerId: user.id });

    return NextResponse.json({ 
      success: true, 
      template: {
        ...template,
        shifts: shifts || []
      }
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Schedule template ID is required' },
        { status: 400 }
      );
    }

    // Create service role client to bypass RLS
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

    // Get current user from session
    let user = null;
    let authError = null;

    // Method 1: Check Authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const result = await supabase.auth.getUser(token);
      user = result.data.user;
      authError = result.error;
    }

    // Method 2: If no header, try to get from cookies (for client-side requests)
    if (!user && !authError) {
      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser();
      user = cookieUser;
      authError = cookieError;
    }

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Delete publish history first (due to foreign key constraint)
    const { error: historyError } = await supabase
      .from('schedule_publish_history')
      .delete()
      .eq('schedule_template_id', id);

    if (historyError) {
      console.error('Error deleting publish history:', historyError);
      // Continue — table may not exist or no records
    }

    // Delete shift templates (due to foreign key constraint)
    const { error: shiftsError } = await supabase
      .from('shift_templates')
      .delete()
      .eq('schedule_template_id', id);

    if (shiftsError) {
      console.error('Error deleting shift templates:', shiftsError);
      // Continue with schedule template deletion even if shifts fail
    }

    // Delete the schedule template
    const { error: templateError } = await supabase
      .from('schedule_templates')
      .delete()
      .eq('id', id)
      .eq('manager_id', user.id); // Ensure user owns this template

    if (templateError) {
      console.error('Database error:', templateError);
      return NextResponse.json(
        { error: templateError.message },
        { status: 500 }
      );
    }

    console.log('Schedule template deleted successfully:', { templateId: id, managerId: user.id });

    return NextResponse.json({ 
      success: true
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
