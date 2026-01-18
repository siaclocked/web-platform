import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, firstName, lastName, phone } = await request.json();

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create service role client to bypass RLS and use admin methods
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

    // Get manager's company (for now, we'll use the first company found)
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .single();

    if (!company) {
      return NextResponse.json(
        { error: 'No company found' },
        { status: 404 }
      );
    }

    // Create worker account with email (no password - they'll use OTP)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      email_confirm: true,
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone?.trim() || null
      }
    });

    if (authError) throw authError;

    if (!authData.user) throw new Error('Failed to create worker account');

    // Create user profile
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        company_id: company.id,
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone?.trim() || null,
        role: 'worker',
        is_active: true
      });

    if (profileError) throw profileError;

    console.log('Worker created successfully:', { 
      userId: authData.user.id, 
      email,
      companyId: company.id 
    });

    return NextResponse.json({ 
      success: true, 
      userId: authData.user.id 
    });
  } catch (err) {
    console.error('Error creating worker:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create worker account' },
      { status: 500 }
    );
  }
}
