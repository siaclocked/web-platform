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
      process.env.SUPABASE_SECRET_KEY!,
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
    const transformedSessions = sessions?.map(session => {
      const p = session.places as any;
      const placeName = p
        ? (Array.isArray(p) ? p[0]?.name : p.name) || 'Unknown Location'
        : 'Unknown Location';
      return {
        id: session.id,
        start_time: session.start_time,
        end_time: session.end_time,
        place: { name: placeName },
      };
    }) || [];

    return NextResponse.json(transformedSessions);

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json([], { status: 200 });
  }
}
