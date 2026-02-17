import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function PUT(request: Request) {
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

    const { first_name, last_name, phone } = await request.json();

    // Workers can only update limited fields
    const updateFields: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (first_name?.trim()) {
      updateFields.first_name = first_name.trim();
    }

    if (last_name?.trim()) {
      updateFields.last_name = last_name.trim();
    }

    if (phone !== undefined) {
      updateFields.phone = phone?.trim() || null;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateFields)
      .eq('id', user.id)
      .select('id, first_name, last_name, phone')
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, user: data });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
