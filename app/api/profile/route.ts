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

    // Fetch worker's positions (skills)
    const { data: workerSkills } = await supabase
      .from('worker_skills')
      .select('skill_id, skills:skill_id (id, name, color)')
      .eq('worker_id', userId);

    const positions = (workerSkills || []).map(ws => ({
      id: (ws.skills as any)?.id || ws.skill_id,
      name: (ws.skills as any)?.name || 'Unknown',
      color: (ws.skills as any)?.color || '#3b82f6'
    }));

    // Fetch worker's places
    const { data: workerPlaces } = await supabase
      .from('worker_places')
      .select('place_id, places:place_id (id, name, address)')
      .eq('worker_id', userId)
      .eq('is_active', true);

    const places = (workerPlaces || []).map(wp => ({
      id: (wp.places as any)?.id || wp.place_id,
      name: (wp.places as any)?.name || 'Unknown',
      address: (wp.places as any)?.address || null
    }));

    return NextResponse.json({
      ...profile,
      companies,
      positions,
      places
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
