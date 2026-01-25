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

    // Fetch user profile with service role (bypasses RLS)
    const { data: profile, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, phone, role, avatar_url, hourly_rate, company_id, created_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Service role query error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Fetch company name separately
    let companies = { id: '', name: '' };
    if (profile?.company_id) {
      const { data: companyData } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', profile.company_id)
        .single();

      if (companyData) {
        companies = companyData;
      }
    }

    return NextResponse.json({
      ...profile,
      companies
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
