import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  try {
    const authClient = await createClient();
    
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = getServiceSupabase();

    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (userData.role !== 'manager') {
      return NextResponse.json(
        { error: 'Only company admins can access this endpoint' },
        { status: 403 }
      );
    }

    const { data: places, error: placesError } = await supabase
      .from('places')
      .select(`
        id,
        name,
        address,
        created_at,
        manager_id,
        manager:manager_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('company_id', userData.company_id)
      .order('name', { ascending: true });

    if (placesError) {
      console.error('Error fetching places:', placesError);
      return NextResponse.json(
        { error: 'Failed to fetch places' },
        { status: 500 }
      );
    }

    const placesWithCounts = await Promise.all(
      (places || []).map(async (place) => {
        const { count: workerCount } = await supabase
          .from('worker_places')
          .select('*', { count: 'exact', head: true })
          .eq('place_id', place.id)
          .eq('is_active', true);

        const { count: scheduleCount } = await supabase
          .from('schedule_templates')
          .select('*', { count: 'exact', head: true })
          .eq('place_id', place.id)
          .eq('status', 'published');

        return {
          ...place,
          worker_count: workerCount || 0,
          active_schedule_count: scheduleCount || 0
        };
      })
    );

    return NextResponse.json({ places: placesWithCounts });
  } catch (error) {
    console.error('Error in admin places endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
