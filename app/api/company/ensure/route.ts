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

    // Check if user has a company
    const { data: user } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', userId)
      .single();

    if (user?.company_id) {
      return NextResponse.json({ companyId: user.company_id });
    }

    // Create a new company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: 'Default Company',
        timezone: 'America/New_York',
        is_active: true
      })
      .select()
      .single();

    if (companyError) throw companyError;

    // Update user with company_id
    const { error: updateError } = await supabase
      .from('users')
      .update({ company_id: company.id })
      .eq('id', userId);

    if (updateError) throw updateError;

    console.log('Created company and updated user:', { userId, companyId: company.id });

    return NextResponse.json({ companyId: company.id });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
