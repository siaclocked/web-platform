import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { workerId } = await request.json();

    if (!workerId) {
      return NextResponse.json(
        { error: 'Worker ID is required' },
        { status: 400 }
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

    // Deactivate worker (soft delete)
    const { error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', workerId)
      .eq('role', 'worker');

    if (error) throw error;

    // Also sign them out from Supabase auth
    await supabase.auth.admin.deleteUser(workerId);

    console.log('Worker removed successfully:', { workerId });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error removing worker:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to remove worker' },
      { status: 500 }
    );
  }
}
