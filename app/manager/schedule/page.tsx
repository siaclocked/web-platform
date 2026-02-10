'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { BackButton } from '@/components/ui';
import { Calendar, Users, Clock, MapPin, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface SolverAssignment {
  worker_id: string;
  worker_name: string;
  skill_id: string;
  day: number;
  start_minutes: number;
  end_minutes: number;
}

interface SolverResult {
  status: string;
  assignments: SolverAssignment[];
  coverage_gaps: any[];
  diagnostics: string[];
  solve_time_ms: number;
  total_hours_by_worker: Record<string, number>;
}

interface ScheduleTemplate {
  id: string;
  name: string;
  place_id: string;
  start_date: string;
  end_date: string;
  status: string;
  solver_status: string | null;
  solver_result: SolverResult | null;
  solver_processed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Place {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
}

export default function ManagerSchedulePage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleTemplate[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    await Promise.all([fetchSchedules(), fetchPlaces(), fetchPositions()]);
    setIsLoading(false);
  };

  const fetchSchedules = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch('/api/manager/schedule-templates', {
        headers: {
          'Authorization': `Bearer ${session.access_token || ''}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Only show templates that have been solved (closed with solver results)
        const solvedTemplates = (data.templates || []).filter(
          (t: any) => t.status === 'closed' && t.solver_status && t.solver_result
        );
        setSchedules(solvedTemplates);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const fetchPlaces = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/manager/places', {
        headers: {
          'Authorization': `Bearer ${session.access_token || ''}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPlaces(data.places || []);
      }
    } catch (error) {
      console.error('Error fetching places:', error);
    }
  };

  const fetchPositions = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/manager/positions', {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  };

  const getPlaceName = (placeId: string) => {
    return places.find(p => p.id === placeId)?.name || 'Unknown Place';
  };

  const getPositionName = (skillId: string) => {
    return positions.find(p => p.id === skillId)?.name || skillId;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatMinutesToTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const getSolverStatusVariant = (solverStatus: string | null): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
    switch (solverStatus) {
      case 'completed': return 'success';
      case 'failed': return 'danger';
      case 'processing': return 'warning';
      default: return 'default';
    }
  };

  const getSolverStatusLabel = (solverStatus: string | null, solverResult: SolverResult | null): string => {
    if (solverStatus === 'completed' && solverResult) {
      if (solverResult.status === 'OPTIMAL') return 'Optimal';
      if (solverResult.status === 'FEASIBLE') return 'Feasible';
      return 'Generated';
    }
    if (solverStatus === 'failed') return 'Failed';
    if (solverStatus === 'processing') return 'Processing';
    return 'Unknown';
  };

  const getAssignmentsByDay = (assignments: SolverAssignment[], startDate: string) => {
    const dayMap: Record<number, SolverAssignment[]> = {};
    assignments.forEach(a => {
      if (!dayMap[a.day]) dayMap[a.day] = [];
      dayMap[a.day].push(a);
    });

    // Sort each day's assignments by start time
    Object.keys(dayMap).forEach(day => {
      dayMap[Number(day)].sort((a, b) => a.start_minutes - b.start_minutes);
    });

    return dayMap;
  };

  const getDayDate = (startDate: string, dayOffset: number) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayOffset);
    return date;
  };

  const toggleExpand = (id: string) => {
    setExpandedSchedule(prev => prev === id ? null : id);
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton href="/manager" label="Back to Dashboard" className="mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Generated Schedules</h1>
              <p className="text-foreground-muted">
                Schedules generated from your timesheets
              </p>
            </div>
            <Link href="/manager/timesheets">
              <Button>
                <Calendar className="w-4 h-4 mr-2" />
                Go to Timesheets
              </Button>
            </Link>
          </div>
        </div>

        {schedules.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No generated schedules yet</h3>
              <p className="text-muted-foreground mb-4">
                Create a timesheet, publish it, let workers set availability, then close it to generate a schedule.
              </p>
              <Link href="/manager/timesheets">
                <Button>
                  <Calendar className="w-4 h-4 mr-2" />
                  Create a Timesheet
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {schedules.map((schedule) => {
              const isExpanded = expandedSchedule === schedule.id;
              const result = schedule.solver_result;
              const assignmentCount = result?.assignments?.length || 0;
              const gapCount = result?.coverage_gaps?.length || 0;
              const uniqueWorkers = result ? new Set(result.assignments?.map(a => a.worker_id)).size : 0;

              return (
                <Card key={schedule.id}>
                  <CardContent className="p-4">
                    {/* Header */}
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleExpand(schedule.id)}
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{schedule.name}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <div className="flex items-center gap-1 text-sm text-foreground-muted">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{getPlaceName(schedule.place_id)}</span>
                          </div>
                          <span className="text-foreground-muted">·</span>
                          <div className="flex items-center gap-1 text-sm text-foreground-muted">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatDate(schedule.start_date)} - {formatDate(schedule.end_date)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <Badge variant={getSolverStatusVariant(schedule.solver_status)}>
                            {getSolverStatusLabel(schedule.solver_status, result)}
                          </Badge>
                          <span className="text-sm text-foreground-muted flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {uniqueWorkers} workers · {assignmentCount} shifts
                          </span>
                          {gapCount > 0 && (
                            <span className="text-sm text-warning flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {gapCount} gaps
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-foreground-muted" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-foreground-muted" />
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && result && (
                      <div className="mt-4 pt-4 border-t border-border space-y-4">
                        {/* Diagnostics */}
                        {result.diagnostics && result.diagnostics.length > 0 && (
                          <div className="p-3 bg-background-secondary rounded-lg">
                            <h4 className="text-sm font-medium text-foreground mb-2">Solver Info</h4>
                            <ul className="text-sm text-foreground-muted space-y-1">
                              {result.diagnostics.map((d, i) => (
                                <li key={i}>· {d}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Hours by worker */}
                        {result.total_hours_by_worker && Object.keys(result.total_hours_by_worker).length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-foreground mb-2">Hours by Worker</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {Object.entries(result.total_hours_by_worker).map(([workerId, hours]) => {
                                const workerName = result.assignments?.find(a => a.worker_id === workerId)?.worker_name || workerId;
                                return (
                                  <div key={workerId} className="p-2 bg-background-secondary rounded-lg text-sm">
                                    <span className="font-medium text-foreground">{workerName}</span>
                                    <span className="text-foreground-muted ml-2">{Number(hours).toFixed(1)}h</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Assignments by day */}
                        {result.assignments && result.assignments.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-foreground mb-2">Schedule</h4>
                            <div className="space-y-3">
                              {Object.entries(getAssignmentsByDay(result.assignments, schedule.start_date))
                                .sort(([a], [b]) => Number(a) - Number(b))
                                .map(([dayStr, dayAssignments]) => {
                                  const dayNum = Number(dayStr);
                                  const dayDate = getDayDate(schedule.start_date, dayNum);
                                  return (
                                    <Card key={dayStr} className="border-border/50">
                                      <CardContent className="p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Calendar className="w-4 h-4 text-primary" />
                                          <span className="font-medium text-sm text-foreground">
                                            {dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                          </span>
                                          <Badge variant="default" className="text-xs">
                                            {dayAssignments.length} shifts
                                          </Badge>
                                        </div>
                                        <div className="space-y-1.5">
                                          {dayAssignments.map((assignment, idx) => (
                                            <div
                                              key={idx}
                                              className="flex items-center gap-3 p-2 bg-background-secondary rounded text-sm"
                                            >
                                              <div className="flex items-center gap-1.5 text-foreground-muted">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>
                                                  {formatMinutesToTime(assignment.start_minutes)} - {formatMinutesToTime(assignment.end_minutes)}
                                                </span>
                                              </div>
                                              <span className="font-medium text-foreground">
                                                {assignment.worker_name}
                                              </span>
                                              <Badge variant="info" className="text-xs">
                                                {getPositionName(assignment.skill_id)}
                                              </Badge>
                                            </div>
                                          ))}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {/* Coverage gaps */}
                        {result.coverage_gaps && result.coverage_gaps.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-warning mb-2">Coverage Gaps</h4>
                            <div className="space-y-1.5">
                              {result.coverage_gaps.map((gap, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3 p-2 bg-warning-muted/20 rounded text-sm"
                                >
                                  <AlertCircle className="w-4 h-4 text-warning" />
                                  <span className="text-foreground">
                                    Day {gap.day}: {formatMinutesToTime(gap.start_minutes)} - {formatMinutesToTime(gap.end_minutes)}
                                  </span>
                                  <Badge variant="warning" className="text-xs">
                                    {getPositionName(gap.skill_id)}
                                  </Badge>
                                  <span className="text-foreground-muted">
                                    {gap.assigned}/{gap.required} workers
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* No assignments */}
                        {(!result.assignments || result.assignments.length === 0) && (
                          <div className="text-center py-4">
                            <p className="text-foreground-muted">No assignments were generated for this schedule.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
