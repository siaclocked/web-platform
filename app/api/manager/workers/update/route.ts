import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PUT(request: Request) {
  try {
    const { workerId, positionIds, placeIds, hourly_rate } = await request.json();

    if (!workerId) {
      return NextResponse.json(
        { error: 'Worker ID is required' },
        { status: 400 }
      );
    }

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

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify worker belongs to same company
    const { data: workerData } = await supabase
      .from('users')
      .select('id')
      .eq('id', workerId)
      .eq('company_id', userData.company_id)
      .single();

    if (!workerData) {
      return NextResponse.json(
        { error: 'Worker not found or access denied' },
        { status: 404 }
      );
    }

    // Update worker hourly rate
    const { error: updateError } = await supabase
      .from('users')
      .update({
        hourly_rate: hourly_rate || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workerId);

    if (updateError) {
      console.error('Error updating worker:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Update worker positions (skills)
    if (positionIds !== undefined) {
      // Delete existing skills
      await supabase
        .from('worker_skills')
        .delete()
        .eq('worker_id', workerId);

      // Insert new skills
      if (positionIds && positionIds.length > 0) {
        const skillInserts = positionIds.map((positionId: string) => ({
          worker_id: workerId,
          skill_id: positionId,
          rating: 3
        }));
        
        const { error: skillsError } = await supabase
          .from('worker_skills')
          .insert(skillInserts);
        
        if (skillsError) {
          console.error('Error updating worker skills:', skillsError);
        }
      }
    }

    // Update worker places
    if (placeIds !== undefined) {
      // Delete existing places
      await supabase
        .from('worker_places')
        .delete()
        .eq('worker_id', workerId);

      // Insert new places
      if (placeIds && placeIds.length > 0) {
        const placeInserts = placeIds.map((placeId: string) => ({
          worker_id: workerId,
          place_id: placeId,
          is_active: true
        }));
        
        const { error: placesError } = await supabase
          .from('worker_places')
          .insert(placeInserts);
        
        if (placesError) {
          console.error('Error updating worker places:', placesError);
        }
      }
    }

    console.log('Worker updated successfully:', { 
      workerId, 
      positions: positionIds?.length || 0,
      places: placeIds?.length || 0
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
