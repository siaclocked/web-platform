import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Create service role client to bypass RLS for data access
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

    // Get user from session token in request
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get manager's company and positions
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

    const { data: skills, error } = await supabase
      .from('skills')
      .select('*')
      .eq('company_id', userData.company_id);

    if (error) {
      console.error('Database error:', error);
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('Skills table does not exist yet');
        return NextResponse.json({ 
          positions: [] 
        });
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Get worker counts for each skill/position
    let positionsWithCounts = (skills || []).map(skill => ({
      id: skill.id,
      name: skill.name,
      color: skill.color,
      created_at: skill.created_at,
      worker_count: 0
    }));

    if (positionsWithCounts.length > 0) {
      try {
        // Get all worker_skills with worker names
        const { data: workerSkills } = await supabase
          .from('worker_skills')
          .select('skill_id, worker_id, users!worker_skills_worker_id_fkey(id, first_name, last_name)');
        
        const skillWorkers: { [key: string]: { id: string; name: string }[] } = {};
        (workerSkills || []).forEach((ws: any) => {
          if (!skillWorkers[ws.skill_id]) skillWorkers[ws.skill_id] = [];
          const u = ws.users;
          const name = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : 'Unknown';
          skillWorkers[ws.skill_id].push({ id: ws.worker_id, name });
        });

        positionsWithCounts = positionsWithCounts.map(pos => ({
          ...pos,
          worker_count: (skillWorkers[pos.id] || []).length,
          workers: skillWorkers[pos.id] || [],
        }));
      } catch (countError) {
        console.error('Error getting worker counts:', countError);
      }
    }

    return NextResponse.json({ 
      positions: positionsWithCounts 
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, description } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Position name is required' },
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

    // Get current user from session - try multiple methods
    let user = null;
    let authError = null;

    // Method 1: Check Authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const result = await supabase.auth.getUser(token);
      user = result.data.user;
      authError = result.error;
    }

    // Method 2: If no header, try to get from cookies (for client-side requests)
    if (!user && !authError) {
      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser();
      user = cookieUser;
      authError = cookieError;
    }

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get manager's company
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

    // Create skill (position) in the skills table
    const { data, error } = await supabase
      .from('skills')
      .insert({
        company_id: userData.company_id,
        name: name.trim(),
        color: '#3b82f6', // Default blue color
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json(
          { error: 'Skills table not found. Please run the database migration first.' },
          { status: 400 }
        );
      }
      // Handle duplicate name
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A position with this name already exists' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('Position/skill created successfully:', { skillId: data.id });

    return NextResponse.json({ 
      success: true, 
      position: data 
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
