import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { name, address, settings } = await request.json();
    const { id: placeId } = await params;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Place name is required' },
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

    // Build update object
    const updateData: Record<string, any> = {
      name: name.trim(),
      address: address?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (settings) {
      updateData.settings = settings;
    }

    // Update place
    const { data, error } = await supabase
      .from('places')
      .update(updateData)
      .eq('id', placeId)
      .eq('manager_id', user.id) // Ensure manager owns this place
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Place not found or access denied' },
        { status: 404 }
      );
    }

    console.log('Place updated successfully:', { placeId: data.id, managerId: user.id });

    return NextResponse.json({ 
      success: true, 
      place: data 
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: placeId } = await params;
    
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

    // Check if place has workers assigned
    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('place_id', placeId)
      .eq('manager_id', user.id);

    if (countError) {
      console.error('Database error:', countError);
      return NextResponse.json(
        { error: 'Failed to check workers' },
        { status: 500 }
      );
    }

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete place with assigned workers' },
        { status: 400 }
      );
    }

    // Delete place
    const { error } = await supabase
      .from('places')
      .delete()
      .eq('id', placeId)
      .eq('manager_id', user.id); // Ensure manager owns this place

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('Place deleted successfully:', { placeId, managerId: user.id });

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
