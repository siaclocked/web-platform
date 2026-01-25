import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { managerId, period } = await request.json();

    if (!managerId) {
      return NextResponse.json(
        { error: 'Manager ID is required' },
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

    // Get the manager's company_id first
    const { data: managerData, error: managerError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', managerId)
      .single();

    if (managerError || !managerData) {
      return NextResponse.json(
        { error: 'Manager not found' },
        { status: 404 }
      );
    }

    // Get all workers in the same company
    const { data: workers, error: workersError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('company_id', managerData.company_id)
      .eq('role', 'worker');

    if (workersError) {
      console.error('Workers fetch error:', workersError);
      return NextResponse.json([], { status: 200 });
    }

    // Get work sessions for the period
    let dateFilter: { start_time?: string; end_time?: string } = {};
    const now = new Date();
    
    if (period === 'current') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      dateFilter = {
        start_time: startOfMonth.toISOString(),
        end_time: endOfMonth.toISOString()
      };
    } else if (period === 'previous') {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const startOfPrevMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
      const endOfPrevMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0);
      dateFilter = {
        start_time: startOfPrevMonth.toISOString(),
        end_time: endOfPrevMonth.toISOString()
      };
    }

    // Get work sessions for all workers in the company
    const workerIds = workers?.map(w => w.id) || [];
    
    if (workerIds.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from('work_sessions')
      .select('worker_id, start_time, end_time')
      .in('worker_id', workerIds)
      .gte('start_time', dateFilter.start_time || '')
      .lte('end_time', dateFilter.end_time || new Date().toISOString());

    if (sessionsError) {
      console.error('Sessions fetch error:', sessionsError);
      return NextResponse.json([], { status: 200 });
    }

    // Calculate timesheets for each worker
    const timesheets = workers?.map(worker => {
      const workerSessions = sessions?.filter(session => session.worker_id === worker.id) || [];
      
      let totalHours = 0;
      workerSessions.forEach(session => {
        if (session.start_time && session.end_time) {
          const start = new Date(session.start_time);
          const end = new Date(session.end_time);
          totalHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
      });

      return {
        id: `timesheet-${worker.id}-${period || 'all'}`,
        worker_name: `${worker.first_name} ${worker.last_name}`,
        worker_id: worker.id,
        period: period === 'current' ? now.toISOString().slice(0, 7) : 
               period === 'previous' ? new Date(now.getFullYear(), now.getMonth() - 1).toISOString().slice(0, 7) :
               'all',
        total_hours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
        approved_hours: Math.round(totalHours * 100) / 100, // Initially same as total
        status: 'pending' as const,
        created_at: new Date().toISOString()
      };
    }).filter(timesheet => timesheet.total_hours > 0) || []; // Only show workers with hours

    return NextResponse.json(timesheets);

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json([], { status: 200 });
  }
}
