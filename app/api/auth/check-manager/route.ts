import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
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

    // Check if email exists as a manager in any company
    const { data: managerData, error } = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        company_id,
        companies!inner(name)
      `)
      .eq('email', email.trim().toLowerCase())
      .eq('role', 'manager')
      .eq('is_active', true)
      .single();

    console.log('Manager lookup result:', { managerData, error });

    if (error || !managerData) {
      return NextResponse.json(
        { error: 'Manager not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      managerData,
      error: null 
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
