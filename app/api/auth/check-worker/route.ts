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
      prefix: 'check-worker',
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
      process.env.SUPABASE_SECRET_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if worker exists
    const { data: workerData, error } = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        company_id,
        companies!inner(name)
      `)
      .eq('email', email.trim().toLowerCase())
      .eq('role', 'worker')
      .eq('is_active', true)
      .single();

    console.log('Worker check result:', { email, workerData, error });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      );
    }

    if (!workerData) {
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      workerData, 
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
