import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { managerId } = await request.json();

    if (!managerId) {
      return NextResponse.json(
        { error: 'Manager ID is required' },
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

    // Deactivate manager (soft delete)
    const { error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', managerId)
      .eq('role', 'manager');

    if (error) throw error;

    // Also sign them out from Supabase auth
    await supabase.auth.admin.deleteUser(managerId);

    console.log('Manager removed successfully:', { managerId });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error removing manager:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to remove manager' },
      { status: 500 }
    );
  }
}
