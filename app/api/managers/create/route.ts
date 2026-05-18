import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, firstName, lastName, phone, companyId } = await request.json();

    if (!email || !firstName || !lastName || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create service role client to bypass RLS and use admin methods
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

    // Create manager account with email (no password - they'll use OTP)
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

    if (!authData.user) throw new Error('Failed to create manager account');

    // Create user profile
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        company_id: companyId,
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone?.trim() || null,
        role: 'manager',
        is_active: true
      });

    if (profileError) throw profileError;

    console.log('Manager created successfully:', { 
      userId: authData.user.id, 
      email,
      companyId 
    });

    return NextResponse.json({ 
      success: true, 
      userId: authData.user.id 
    });
  } catch (err) {
    console.error('Error creating manager:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create manager account' },
      { status: 500 }
    );
  }
}
