import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS
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

    // Get the user's company_id first
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { total_workers: 0 },
        { status: 200 }
      );
    }

    // Count workers in the same company
    const { data: workers, error: countError } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .eq('company_id', userData.company_id)
      .eq('role', 'worker');

    if (countError) {
      console.error('Worker count error:', countError);
      return NextResponse.json(
        { total_workers: 0 },
        { status: 200 }
      );
    }

    return NextResponse.json({
      total_workers: workers?.length || 0
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { total_workers: 0 },
      { status: 200 }
    );
  }
}
