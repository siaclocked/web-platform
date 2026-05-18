import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  try {
    const { email, accessToken, password } = await request.json();

    if (!email || !accessToken || !password) {
      return NextResponse.json(
        { error: 'Email, access token, and password are required' },
        { status: 400 }
      );
    }

    // Rate limit: 3 attempts per email per 15 minutes
    const rateCheck = checkRateLimit({
      prefix: 'set-password',
      key: email,
      maxAttempts: 3,
      windowSeconds: 15 * 60,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Verify the access token to confirm the user's identity
    // The token was obtained client-side after successful OTP verification
    const { data: { user: verifiedUser }, error: tokenError } = await supabase.auth.getUser(accessToken);

    if (tokenError || !verifiedUser) {
      console.error('Token verification error:', tokenError);
      return NextResponse.json(
        { error: 'Invalid or expired session. Please verify your email again.' },
        { status: 401 }
      );
    }

    // Ensure the verified user matches the email
    if (verifiedUser.email?.toLowerCase() !== normalizedEmail) {
      return NextResponse.json(
        { error: 'Session does not match the provided email.' },
        { status: 403 }
      );
    }

    // 2. Verify the manager exists and doesn't already have a password
    const { data: managerData, error: managerError } = await supabase
      .from('users')
      .select('id, has_password')
      .eq('email', normalizedEmail)
      .eq('role', 'manager')
      .eq('is_active', true)
      .single();

    if (managerError || !managerData) {
      return NextResponse.json(
        { error: 'Manager account not found' },
        { status: 404 }
      );
    }

    if (managerData.has_password) {
      return NextResponse.json(
        { error: 'Password is already set for this account. Please log in with your password.' },
        { status: 400 }
      );
    }

    // 3. Set the password AND mark has_password in app_metadata using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      managerData.id,
      {
        password,
        app_metadata: { has_password: true },
      }
    );

    if (updateError) {
      console.error('Error setting password:', updateError);
      return NextResponse.json(
        { error: 'Failed to set password. Please try again.' },
        { status: 500 }
      );
    }

    // 4. Also mark has_password = true in our users table (belt + suspenders)
    const { data: updatedUser, error: flagError } = await supabase
      .from('users')
      .update({ has_password: true })
      .eq('id', managerData.id)
      .select('id, has_password')
      .single();

    console.log('has_password update result:', { updatedUser, flagError });

    if (flagError) {
      console.error('Error updating has_password flag in users table:', flagError);
      // Not fatal — app_metadata already has the flag
    }

    // 5. Sign the user in with their new password to return a session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError) {
      // Password was set but auto-sign-in failed — user can sign in manually
      console.error('Auto sign-in error:', signInError);
      return NextResponse.json({
        success: true,
        message: 'Password set successfully. Please log in with your new password.',
        session: null,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Password set successfully!',
      session: signInData.session,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
