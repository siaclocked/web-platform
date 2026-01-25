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

    // Fetch work sessions with place information
    const { data: sessions, error } = await supabase
      .from('work_sessions')
      .select(`
        id,
        start_time,
        end_time,
        place_id,
        places:place_id (
          name
        )
      `)
      .eq('worker_id', userId)
      .order('start_time', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Work sessions error:', error);
      return NextResponse.json([], { status: 200 });
    }

    // Transform the data to match the expected format
    const transformedSessions = sessions?.map(session => ({
      id: session.id,
      start_time: session.start_time,
      end_time: session.end_time,
      place: session.places && Array.isArray(session.places) && session.places.length > 0 
        ? { name: session.places[0].name } 
        : { name: 'Unknown Location' }
    })) || [];

    return NextResponse.json(transformedSessions);

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json([], { status: 200 });
  }
}
