import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { userError: 'User ID is required' },
        { status: 400 }
      );
    }

    // Create service role client to bypass RLS
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

    // Check user role using service role
    const { data: userData, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    console.log('Role check result:', { userId, userData, error });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { userError: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ userData, userError: null });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { userError: 'Internal server error' },
      { status: 500 }
    );
  }
}
