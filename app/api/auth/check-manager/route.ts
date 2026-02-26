import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Rate limit: 5 attempts per email per 15 minutes
    const rateCheck = checkRateLimit({
      prefix: 'check-manager',
      key: email,
      maxAttempts: 5,
      windowSeconds: 15 * 60,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.` },
        { status: 429 }
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
        has_password,
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

    // Check has_password from DB; also check Supabase auth app_metadata as fallback
    let hasPassword = managerData.has_password || false;

    if (!hasPassword) {
      // Fallback: check app_metadata in Supabase auth (set atomically with password)
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(managerData.id);
        if (authUser?.user?.app_metadata?.has_password) {
          hasPassword = true;
          // Sync the DB flag if it's out of date
          await supabase
            .from('users')
            .update({ has_password: true })
            .eq('id', managerData.id);
          console.log('Synced has_password from app_metadata for manager:', managerData.id);
        }
      } catch (metaErr) {
        console.error('Error checking auth metadata:', metaErr);
      }
    }

    return NextResponse.json({ 
      managerData: { ...managerData, has_password: hasPassword },
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
