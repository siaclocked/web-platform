import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { name, description } = await request.json();
    const { id: positionId } = await params;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Position name is required' },
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

    // Get current user from session - try multiple methods
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

    const { data, error } = await supabase
      .from('skills')
      .update({
        name: name.trim(),
      })
      .eq('id', positionId)
      .eq('company_id', userData.company_id)
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
        { error: 'Position not found or access denied' },
        { status: 404 }
      );
    }

    console.log('Position updated successfully:', { positionId: data.id, managerId: user.id });

    return NextResponse.json({ 
      success: true, 
      position: {
        ...data,
        description: description?.trim() || null
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: positionId } = await params;
    
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

    // Get current user from session - try multiple methods
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

    const { count, error: countError } = await supabase
      .from('worker_skills')
      .select('*', { count: 'exact', head: true })
      .eq('skill_id', positionId);

    if (countError) {
      console.error('Database error:', countError);
      return NextResponse.json(
        { error: 'Failed to check workers' },
        { status: 500 }
      );
    }

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete position with assigned workers' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('skills')
      .delete()
      .eq('id', positionId)
      .eq('company_id', userData.company_id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('Position deleted successfully:', { positionId, managerId: user.id });

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
