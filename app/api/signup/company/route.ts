import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    console.log('API: Company signup request received');
    
    const { companyData, adminData } = await request.json();
    console.log('API: Received data:', { companyData, adminData });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      console.error('API: Supabase env vars not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    
    console.log('API: Creating Supabase client with URL:', supabaseUrl);
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('API: Creating company:', companyData.name);

    // 1. Create the company
    try {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyData.name.trim()
        })
        .select()
        .single();

      console.log('Company creation result:', { company, companyError });

      if (companyError) {
        console.error('API: Company creation error:', companyError);
        return NextResponse.json({ error: `Company creation failed: ${companyError.message}` }, { status: 400 });
      }

      console.log('API: Company created successfully:', company.id);

      // 2. Create the user account with password
      console.log('API: Creating user account:', adminData.email);
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: adminData.email.trim().toLowerCase(),
        password: adminData.password,
        email_confirm: true, // Skip email confirmation for company admin
        user_metadata: {
          first_name: adminData.firstName.trim(),
          last_name: adminData.lastName.trim(),
          phone: adminData.phone.trim() || null
        }
      });

      console.log('User creation result:', { authData, authError });

      if (authError) {
        console.error('API: User creation error:', authError);
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      if (!authData.user) {
        return NextResponse.json({ error: 'Failed to create user account' }, { status: 400 });
      }

      console.log('API: User created successfully:', authData.user.id);

      // 3. Create the user profile
      console.log('API: Creating user profile');
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          company_id: company.id,
          email: adminData.email.trim().toLowerCase(),
          first_name: adminData.firstName.trim(),
          last_name: adminData.lastName.trim(),
          phone: adminData.phone.trim() || null,
          role: 'admin',
          is_active: true
        });

      console.log('User profile creation result:', { userError });

      if (userError) {
        console.error('API: User profile creation error:', userError);
        return NextResponse.json({ error: userError.message }, { status: 400 });
      }

      console.log('API: User profile created successfully');

      // 4. No sign-in needed - user will use OTP to login
      console.log('API: Company signup completed successfully');

      return NextResponse.json({ 
        success: true, 
        companyId: company.id,
        userId: authData.user.id 
      });
    } catch (dbError) {
      console.error('API: Database operation error:', dbError);
      return NextResponse.json({ 
        error: dbError instanceof Error ? dbError.message : 'Database operation failed' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('API: Company signup error:', error);
    
    // Handle different types of errors
    if (error instanceof SyntaxError) {
      return NextResponse.json({ 
        error: 'Invalid request data format' 
      }, { status: 400 });
    }
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'An unexpected error occurred during company signup' 
    }, { status: 500 });
  }
}
