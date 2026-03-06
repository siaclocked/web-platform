'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';

import { Calendar, Users, Clock, MapPin, ChevronDown, ChevronUp, AlertCircle, Send, CheckCircle, ChevronLeft, ChevronRight, List, LayoutGrid, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

type ViewMode = 'month' | 'week' | 'list';

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

interface FlatShift {
  date: string;
  day: number;
  worker_name: string;
  worker_id: string;
  skill_id: string;
  start_minutes: number;
  end_minutes: number;
  place_name: string;
  schedule_name: string;
  schedule_id: string;
}

interface AvailableWorker {
  id: string;
  name: string;
  skill_ids: string[];
}

export default function ManagerSchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewId = searchParams.get('review');
  const [schedules, setSchedules] = useState<ScheduleTemplate[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    return new Date(now.getFullYear(), now.getMonth(), diff);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [availableWorkers, setAvailableWorkers] = useState<AvailableWorker[]>([]);
  const [savingEdits, setSavingEdits] = useState(false);
  const [showAddShift, setShowAddShift] = useState(false);
  const [addShiftForm, setAddShiftForm] = useState({
    worker_id: '',
    skill_id: '',
    start_minutes: 540,
    end_minutes: 1020,
  });
  const [editingShift, setEditingShift] = useState<{
    scheduleId: string;
    workerId: string;
    day: number;
    origStart: number;
    origEnd: number;
    skillId: string;
    newStart: number;
    newEnd: number;
  } | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  // Auto-expand schedule being reviewed
  useEffect(() => {
    if (reviewId && schedules.length > 0) {
      const target = schedules.find(s => s.id === reviewId);
      if (target) setExpandedSchedule(reviewId);
    }
  }, [reviewId, schedules]);

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
        // Show templates that have been solved or published
        const solvedTemplates = (data.templates || []).filter(
          (t: any) => (t.status === 'closed' || t.status === 'schedule_published') && t.solver_status && t.solver_result
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

  const startEditing = async (scheduleId?: string) => {
    setEditingScheduleId(scheduleId || schedules[0]?.id || null);
    setIsEditing(true);
    setShowAddShift(false);

    // Fetch workers from all schedule places (deduplicated)
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const placeIds = [...new Set(schedules.map(s => s.place_id))];
      const allWorkers: AvailableWorker[] = [];
      const seenIds = new Set<string>();

      for (const placeId of placeIds) {
        const response = await fetch(`/api/manager/places/${placeId}/workers`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        if (response.ok) {
          const data = await response.json();
          (data.workers || []).forEach((w: any) => {
            if (seenIds.has(w.id)) return;
            seenIds.add(w.id);
            allWorkers.push({
              id: w.id,
              name: `${w.first_name || ''} ${w.last_name || ''}`.trim() || 'Unknown',
              skill_ids: (w.skills || []).map((s: any) => s.skill_id || s.id),
            });
          });
        }
      }
      setAvailableWorkers(allWorkers);
    } catch (err) {
      console.error('Error fetching workers:', err);
    }
  };

  const stopEditing = () => {
    setIsEditing(false);
    setEditingScheduleId(null);
    setShowAddShift(false);
  };

  const addManualShift = (scheduleId: string, dateStr: string) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule || !schedule.solver_result) return;

    const worker = availableWorkers.find(w => w.id === addShiftForm.worker_id);
    if (!worker) return;

    const startDate = new Date(schedule.start_date + 'T00:00:00');
    const shiftDate = new Date(dateStr + 'T00:00:00');
    const dayOffset = Math.round((shiftDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    const newAssignment: SolverAssignment = {
      worker_id: worker.id,
      worker_name: worker.name,
      skill_id: addShiftForm.skill_id,
      day: dayOffset,
      start_minutes: addShiftForm.start_minutes,
      end_minutes: addShiftForm.end_minutes,
    };

    const updatedAssignments = [...(schedule.solver_result.assignments || []), newAssignment];
    setSchedules(prev => prev.map(s => {
      if (s.id === scheduleId && s.solver_result) {
        return { ...s, solver_result: { ...s.solver_result!, assignments: updatedAssignments } };
      }
      return s;
    }));
    setShowAddShift(false);
    setAddShiftForm({ worker_id: '', skill_id: '', start_minutes: 540, end_minutes: 1020 });
  };

  const removeShift = (scheduleId: string, workerIdToRemove: string, dayToRemove: number, startMinToRemove: number, endMinToRemove: number, skillIdToRemove: string) => {
    let removed = false;
    setSchedules(prev => prev.map(s => {
      if (s.id === scheduleId && s.solver_result) {
        const filtered = (s.solver_result.assignments || []).filter(a => {
          if (!removed && a.worker_id === workerIdToRemove && a.day === dayToRemove && a.start_minutes === startMinToRemove && a.end_minutes === endMinToRemove && a.skill_id === skillIdToRemove) {
            removed = true;
            return false;
          }
          return true;
        });
        return { ...s, solver_result: { ...s.solver_result, assignments: filtered } };
      }
      return s;
    }));
  };

  const updateShiftTimes = (scheduleId: string, workerId: string, day: number, origStart: number, origEnd: number, skillId: string, newStart: number, newEnd: number) => {
    // Use functional update to ensure we have latest state
    setSchedules(prevSchedules => {
      const scheduleIndex = prevSchedules.findIndex(s => s.id === scheduleId);
      if (scheduleIndex === -1) {
        console.error('Schedule not found:', scheduleId);
        return prevSchedules;
      }
      
      const schedule = prevSchedules[scheduleIndex];
      if (!schedule.solver_result?.assignments) {
        console.error('No assignments in schedule');
        return prevSchedules;
      }
      
      // Find the assignment to update
      const assignmentIndex = schedule.solver_result.assignments.findIndex(a => 
        a.worker_id === workerId && 
        a.day === day && 
        a.start_minutes === origStart && 
        a.end_minutes === origEnd && 
        a.skill_id === skillId
      );
      
      if (assignmentIndex === -1) {
        console.error('Assignment not found:', { workerId, day, origStart, origEnd, skillId });
        console.log('Available assignments:', schedule.solver_result.assignments);
        return prevSchedules;
      }
      
      // Create new assignments array with the updated assignment
      const newAssignments = [...schedule.solver_result.assignments];
      newAssignments[assignmentIndex] = {
        ...newAssignments[assignmentIndex],
        start_minutes: newStart,
        end_minutes: newEnd,
      };
      
      // Create new schedules array with the updated schedule
      const newSchedules = [...prevSchedules];
      newSchedules[scheduleIndex] = {
        ...schedule,
        solver_result: {
          ...schedule.solver_result,
          assignments: newAssignments,
        },
      };
      
      return newSchedules;
    });
    setEditingShift(null);
  };

  const saveEdits = async (silent = false): Promise<boolean> => {
    setSavingEdits(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      // Only save the schedule currently being edited
      const schedule = schedules.find(s => s.id === editingScheduleId);
      if (!schedule || !schedule.solver_result) {
        if (!silent) alert('No schedule selected for editing');
        setSavingEdits(false);
        return false;
      }

      const response = await fetch('/api/manager/schedule-templates/edit-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          schedule_template_id: schedule.id,
          assignments: schedule.solver_result.assignments || [],
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        alert(err.error || `Failed to save changes for "${schedule.name}"`);
        return false;
      } else {
        if (!silent) {
          alert('Schedule changes saved!');
          stopEditing();
          fetchSchedules();
        }
        return true;
      }
    } catch (err) {
      console.error('Error saving edits:', err);
      alert('Failed to save changes');
      return false;
    } finally {
      setSavingEdits(false);
    }
  };

  // Flatten all schedules into a date-keyed map of shifts (deduplicated)
  const flatShiftsByDate = useMemo(() => {
    const map: Record<string, FlatShift[]> = {};
    const seen = new Set<string>();
    schedules.forEach(s => {
      if (!s.solver_result?.assignments) return;
      const placeName = getPlaceName(s.place_id);
      s.solver_result.assignments.forEach(a => {
        const startDate = new Date(s.start_date + 'T00:00:00');
        const shiftDate = new Date(startDate);
        shiftDate.setDate(shiftDate.getDate() + a.day);
        const dateStr = `${shiftDate.getFullYear()}-${String(shiftDate.getMonth() + 1).padStart(2, '0')}-${String(shiftDate.getDate()).padStart(2, '0')}`;

        // Deduplicate: skip if same worker, date, time, skill already added
        const dedupKey = `${s.id}-${a.worker_id}-${dateStr}-${a.start_minutes}-${a.end_minutes}-${a.skill_id}`;
        if (seen.has(dedupKey)) return;
        seen.add(dedupKey);

        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push({
          date: dateStr,
          day: a.day,
          worker_name: a.worker_name,
          worker_id: a.worker_id,
          skill_id: a.skill_id,
          start_minutes: a.start_minutes,
          end_minutes: a.end_minutes,
          place_name: placeName,
          schedule_name: s.name,
          schedule_id: s.id,
        });
      });
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.start_minutes - b.start_minutes));
    return map;
  }, [schedules, places]);

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

  const handlePublish = async (scheduleId: string) => {
    if (!confirm('Publish this schedule? Workers will be notified of their assigned shifts.')) return;
    setPublishingId(scheduleId);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/manager/schedule-templates/publish-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ schedule_template_id: scheduleId }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Schedule published! ${data.workers_notified} worker(s) notified.`);
        fetchSchedules();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to publish schedule');
      }
    } catch (error) {
      console.error('Error publishing schedule:', error);
      alert('Failed to publish schedule');
    } finally {
      setPublishingId(null);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string, scheduleName: string) => {
    if (!confirm(`Are you sure you want to delete "${scheduleName}"? This will remove it from the published schedule and history. This action cannot be undone.`)) {
      return;
    }
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/manager/schedule-templates', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: scheduleId }),
      });

      if (response.ok) {
        fetchSchedules();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to delete schedule');
      }
    } catch (err) {
      console.error('Error deleting schedule:', err);
      alert('Failed to delete schedule');
    }
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

  // Month calendar helpers
  const mYear = currentMonth.getFullYear();
  const mMonth = currentMonth.getMonth();
  const daysInMonth = new Date(mYear, mMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(mYear, mMonth, 1).getDay();
  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayStr = new Date().toISOString().split('T')[0];

  const calendarDays: Array<{ day: number; dateStr: string; isCurrentMonth: boolean }> = [];
  // Previous month filler
  const prevMonthLastDay = new Date(mYear, mMonth, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const pm = mMonth === 0 ? 12 : mMonth;
    const py = mMonth === 0 ? mYear - 1 : mYear;
    calendarDays.push({ day: d, dateStr: `${py}-${String(pm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${mYear}-${String(mMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({ day: d, dateStr, isCurrentMonth: true });
  }
  // Next month filler
  const remainingCells = 7 - (calendarDays.length % 7);
  if (remainingCells < 7) {
    for (let d = 1; d <= remainingCells; d++) {
      const nm = mMonth + 2 > 12 ? 1 : mMonth + 2;
      const ny = mMonth + 2 > 12 ? mYear + 1 : mYear;
      calendarDays.push({ day: d, dateStr: `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
    }
  }

  // Week view helpers
  const weekDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    weekDays.push(d.toISOString().split('T')[0]);
  }

  const selectedDayShifts = selectedDate ? (flatShiftsByDate[selectedDate] || []) : [];

  const renderShiftCard = (shift: FlatShift, idx: number) => (
    <div key={`${shift.worker_id}-${shift.start_minutes}-${idx}`} className="p-2 bg-background-secondary border border-border rounded-lg text-center text-xs">
      <div className="font-medium text-foreground">{shift.worker_name}</div>
      <div className="text-foreground-muted">
        {formatMinutesToTime(shift.start_minutes)}-{formatMinutesToTime(shift.end_minutes)}
      </div>
    </div>
  );

  return (
    <PageContainer>
      <div>
        {/* Review banner */}
        {reviewId && (() => {
          const reviewSchedule = schedules.find(s => s.id === reviewId);
          if (!reviewSchedule) return null;
          const gaps = reviewSchedule.solver_result?.coverage_gaps?.length || 0;
          const assignments = reviewSchedule.solver_result?.assignments?.length || 0;
          const isFeasible = reviewSchedule.solver_result?.status === 'OPTIMAL' || reviewSchedule.solver_result?.status === 'FEASIBLE';
          return (
            <Card className={`mb-4 border-l-4 ${isFeasible && gaps === 0 ? 'border-l-success' : 'border-l-warning'}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Review: {reviewSchedule.name}
                    </h3>
                    <p className="text-sm text-foreground-muted mt-1">
                      {assignments} shift{assignments !== 1 ? 's' : ''} assigned
                      {gaps > 0 && <span className="text-warning ml-2">· {gaps} coverage gap{gaps !== 1 ? 's' : ''}</span>}
                      {gaps === 0 && <span className="text-success ml-2">· No gaps</span>}
                    </p>
                    {reviewSchedule.solver_result?.diagnostics && reviewSchedule.solver_result.diagnostics.length > 0 && (
                      <ul className="mt-2 text-xs text-foreground-muted space-y-0.5">
                        {reviewSchedule.solver_result.diagnostics.slice(0, 3).map((d, i) => (
                          <li key={i}>→ {d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {reviewSchedule.status === 'closed' && (
                      <Button
                        onClick={() => handlePublish(reviewSchedule.id)}
                        isLoading={publishingId === reviewSchedule.id}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Approve & Send to Employees
                      </Button>
                    )}
                    {reviewSchedule.status === 'schedule_published' && (
                      <Badge variant="success">Published</Badge>
                    )}
                    <Button variant="outline" onClick={() => router.push('/manager/schedule')}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Top bar — wireframe style */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {!isEditing && schedules.some(s => s.solver_result) && (
              <Button variant="outline" onClick={() => startEditing()}>
                <Edit2 className="w-4 h-4 mr-1" />
                Edit Schedule
              </Button>
            )}
            {isEditing && (
              <>
                <Button onClick={() => saveEdits()} isLoading={savingEdits}>
                  <Save className="w-4 h-4 mr-1" />
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => { stopEditing(); fetchSchedules(); }}>
                  Cancel
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && schedules.some(s => s.status === 'closed') && (
              <Button onClick={() => {
                const first = schedules.find(s => s.status === 'closed');
                if (first) handlePublish(first.id);
              }}>
                Publish
              </Button>
            )}
            <div className="relative">
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                className="text-sm py-2 pl-3 pr-8 border border-border rounded-lg bg-background text-foreground appearance-none cursor-pointer"
              >
                <option value="month">Month View</option>
                <option value="week">Week View</option>
                <option value="list">List View</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
            </div>
          </div>
        </div>

        {isEditing && (() => {
          const editSchedule = schedules.find(s => s.id === editingScheduleId);
          const gapCount = editSchedule?.solver_result?.coverage_gaps?.length || 0;
          const assignmentCount = editSchedule?.solver_result?.assignments?.length || 0;
          const isReady = gapCount === 0 && assignmentCount > 0;

          return (
            <div className={`mb-4 p-3 rounded-lg flex items-center justify-between gap-2 border ${isReady ? 'bg-success/10 border-success/40' : 'bg-primary-muted/30 border-primary/20'}`}>
              <div className="flex items-center gap-2">
                {isReady ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <Edit2 className="w-4 h-4 text-primary" />
                )}
                <span className="text-sm text-foreground">
                  {isReady ? (
                    <><strong>Schedule is ready to be published!</strong> {assignmentCount} shift{assignmentCount !== 1 ? 's' : ''} assigned, no coverage gaps.</>
                  ) : (
                    <><strong>Editing mode:</strong> Click a day to add/remove shifts. {gapCount > 0 && <span className="text-warning">{gapCount} coverage gap{gapCount !== 1 ? 's' : ''} remaining.</span>}</>
                  )}
                </span>
              </div>
              {isReady && editSchedule?.status === 'closed' && (
                <Button size="sm" onClick={async () => {
                  const saved = await saveEdits(true);
                  if (saved) {
                    stopEditing();
                    handlePublish(editSchedule.id);
                  }
                }} isLoading={savingEdits || publishingId === editSchedule.id}>
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Publish to Employees
                </Button>
              )}
            </div>
          );
        })()}

        {schedules.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
              <h3 className="text-lg font-medium mb-2">No generated schedules yet</h3>
              <p className="text-foreground-muted mb-4">
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
          <>
            {/* ===== MONTH VIEW ===== */}
            {viewMode === 'month' && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(mYear, mMonth - 1, 1))}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-foreground">{monthLabel}</h2>
                        <Button variant="outline" size="sm" onClick={() => {
                          const now = new Date();
                          setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                          setSelectedDate(todayStr);
                        }} className="text-xs">Today</Button>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(mYear, mMonth + 1, 1))}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-7 mb-1">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                        <div key={d} className="text-center text-xs font-semibold text-foreground-muted py-2">{d}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7">
                      {calendarDays.map((cell, idx) => {
                        const shifts = flatShiftsByDate[cell.dateStr] || [];
                        const isToday = cell.dateStr === todayStr;
                        const isSelected = cell.dateStr === selectedDate;
                        const hasShifts = shifts.length > 0;

                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedDate(isSelected ? null : cell.dateStr)}
                            className={`relative flex flex-col items-start p-2 min-h-[80px] border border-border/50 text-left transition-all
                              ${hasShifts && cell.isCurrentMonth ? 'border-success bg-success/5' : ''}
                              ${isSelected ? 'ring-2 ring-primary/40 bg-primary/5' : ''}
                              ${!cell.isCurrentMonth ? 'text-foreground-muted/40' : 'text-foreground'}
                              ${cell.isCurrentMonth && !hasShifts ? 'hover:bg-background-secondary' : ''}`}
                          >
                            <span className={`text-sm font-semibold ${isToday ? 'bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                              {cell.day}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {selectedDate && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-foreground">
                          {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </h3>
                        {isEditing && (
                          <Button size="sm" variant="outline" onClick={() => setShowAddShift(!showAddShift)}>
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add Shift
                          </Button>
                        )}
                      </div>

                      {isEditing && showAddShift && editingScheduleId && (
                        <div className="mb-4 p-3 border border-primary/30 bg-primary-muted/10 rounded-lg space-y-3">
                          <h4 className="text-sm font-medium text-foreground">Add Worker to This Day</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-foreground-muted mb-1">Worker</label>
                              <select
                                value={addShiftForm.worker_id}
                                onChange={(e) => setAddShiftForm(f => ({ ...f, worker_id: e.target.value }))}
                                className="w-full p-2 border border-border rounded text-sm bg-background text-foreground"
                              >
                                <option value="">Select worker...</option>
                                {availableWorkers.map(w => (
                                  <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-foreground-muted mb-1">Position</label>
                              <select
                                value={addShiftForm.skill_id}
                                onChange={(e) => setAddShiftForm(f => ({ ...f, skill_id: e.target.value }))}
                                className="w-full p-2 border border-border rounded text-sm bg-background text-foreground"
                              >
                                <option value="">Select position...</option>
                                {positions.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-foreground-muted mb-1">Start Time</label>
                              <select
                                value={addShiftForm.start_minutes}
                                onChange={(e) => setAddShiftForm(f => ({ ...f, start_minutes: parseInt(e.target.value) }))}
                                className="w-full p-2 border border-border rounded text-sm bg-background text-foreground"
                              >
                                {Array.from({ length: 24 }, (_, h) => [0, 30].map(m => h * 60 + m)).flat().map(mins => (
                                  <option key={mins} value={mins}>{formatMinutesToTime(mins)}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-foreground-muted mb-1">End Time</label>
                              <select
                                value={addShiftForm.end_minutes}
                                onChange={(e) => setAddShiftForm(f => ({ ...f, end_minutes: parseInt(e.target.value) }))}
                                className="w-full p-2 border border-border rounded text-sm bg-background text-foreground"
                              >
                                {Array.from({ length: 24 }, (_, h) => [0, 30].map(m => h * 60 + m)).flat().filter(m => m > addShiftForm.start_minutes).map(mins => (
                                  <option key={mins} value={mins}>{formatMinutesToTime(mins)}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={!addShiftForm.worker_id || !addShiftForm.skill_id}
                              onClick={() => addManualShift(editingScheduleId, selectedDate)}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" />
                              Add
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setShowAddShift(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {selectedDayShifts.length === 0 && !showAddShift ? (
                        <p className="text-sm text-foreground-muted py-2">No shifts scheduled.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedDayShifts.map((shift, idx) => {
                            const isEditingThis = editingShift &&
                              editingShift.scheduleId === shift.schedule_id &&
                              editingShift.workerId === shift.worker_id &&
                              editingShift.day === shift.day &&
                              editingShift.origStart === shift.start_minutes &&
                              editingShift.origEnd === shift.end_minutes &&
                              editingShift.skillId === shift.skill_id;

                            return (
                              <div key={`${shift.worker_id}-${shift.start_minutes}-${shift.end_minutes}-${shift.skill_id}-${idx}`}>
                                <div className="flex items-center gap-3 p-3 bg-background-secondary rounded-lg text-sm">
                                  <div className="flex items-center gap-1.5 text-foreground-muted">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{formatMinutesToTime(shift.start_minutes)} – {formatMinutesToTime(shift.end_minutes)}</span>
                                  </div>
                                  <span className="font-medium text-foreground">{shift.worker_name}</span>
                                  <Badge variant="info" className="text-xs">{getPositionName(shift.skill_id)}</Badge>
                                  {isEditing ? (
                                    <div className="ml-auto flex items-center gap-1">
                                      <button
                                        onClick={() => setEditingShift({
                                          scheduleId: shift.schedule_id,
                                          workerId: shift.worker_id,
                                          day: shift.day,
                                          origStart: shift.start_minutes,
                                          origEnd: shift.end_minutes,
                                          skillId: shift.skill_id,
                                          newStart: shift.start_minutes,
                                          newEnd: shift.end_minutes,
                                        })}
                                        className="p-1 text-primary hover:bg-primary/10 rounded transition-colors"
                                        title="Edit shift times"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => removeShift(shift.schedule_id, shift.worker_id, shift.day, shift.start_minutes, shift.end_minutes, shift.skill_id)}
                                        className="p-1 text-danger hover:bg-danger-muted rounded transition-colors"
                                        title="Remove shift"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-foreground-muted ml-auto flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />{shift.place_name}
                                    </span>
                                  )}
                                </div>
                                {isEditing && isEditingThis && editingShift && (
                                  <div className="mt-1 p-3 border border-primary/30 bg-primary-muted/10 rounded-lg">
                                    <h4 className="text-xs font-medium text-foreground mb-2">Edit Shift Times — {shift.worker_name}</h4>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <div>
                                        <label className="block text-xs text-foreground-muted mb-1">Start</label>
                                        <input
                                          type="time"
                                          value={formatMinutesToTime(editingShift.newStart)}
                                          onChange={(e) => {
                                            const [h, m] = e.target.value.split(':').map(Number);
                                            if (!isNaN(h) && !isNaN(m)) {
                                              setEditingShift(prev => prev ? { ...prev, newStart: h * 60 + m } : null);
                                            }
                                          }}
                                          className="p-1.5 border border-border rounded text-sm bg-background text-foreground"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-foreground-muted mb-1">End</label>
                                        <input
                                          type="time"
                                          value={formatMinutesToTime(editingShift.newEnd)}
                                          onChange={(e) => {
                                            const [h, m] = e.target.value.split(':').map(Number);
                                            if (!isNaN(h) && !isNaN(m)) {
                                              setEditingShift(prev => prev ? { ...prev, newEnd: h * 60 + m } : null);
                                            }
                                          }}
                                          className="p-1.5 border border-border rounded text-sm bg-background text-foreground"
                                        />
                                      </div>
                                      <div className="flex items-end gap-1 pb-0.5">
                                        <Button size="sm" onClick={() => {
                                          if (editingShift.newEnd <= editingShift.newStart) {
                                            alert('End time must be after start time');
                                            return;
                                          }
                                          updateShiftTimes(
                                            editingShift.scheduleId, editingShift.workerId, editingShift.day,
                                            editingShift.origStart, editingShift.origEnd, editingShift.skillId,
                                            editingShift.newStart, editingShift.newEnd
                                          );
                                        }}>
                                          <Save className="w-3 h-3 mr-1" />
                                          Apply
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setEditingShift(null)}>
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ===== WEEK VIEW ===== */}
            {viewMode === 'week' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => {
                    const d = new Date(currentWeekStart);
                    d.setDate(d.getDate() - 7);
                    setCurrentWeekStart(d);
                  }}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">
                      {new Date(weekDays[0] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {new Date(weekDays[6] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => {
                      const now = new Date();
                      const day = now.getDay();
                      const diff = now.getDate() - day;
                      setCurrentWeekStart(new Date(now.getFullYear(), now.getMonth(), diff));
                    }} className="text-xs">This Week</Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    const d = new Date(currentWeekStart);
                    d.setDate(d.getDate() + 7);
                    setCurrentWeekStart(d);
                  }}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map(dateStr => {
                    const shifts = flatShiftsByDate[dateStr] || [];
                    const isToday = dateStr === todayStr;
                    const dt = new Date(dateStr + 'T00:00:00');

                    return (
                      <Card key={dateStr} className={`min-h-[180px] ${isToday ? 'border-primary/40' : ''}`}>
                        <CardContent className="p-2">
                          <div className={`text-center mb-2 pb-1 border-b border-border ${isToday ? 'text-primary font-bold' : 'text-foreground-muted'}`}>
                            <div className="text-xs">{dt.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                            <div className="text-lg font-semibold">{dt.getDate()}</div>
                          </div>
                          <div className="space-y-1.5">
                            {shifts.length === 0 ? (
                              <p className="text-[10px] text-foreground-muted text-center py-2">No shifts</p>
                            ) : shifts.map((shift, idx) => renderShiftCard(shift, idx))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===== LIST VIEW (original with publish) ===== */}
            {viewMode === 'list' && (
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
                              {schedule.status === 'schedule_published' ? (
                                <Badge variant="success">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Published
                                </Badge>
                              ) : (
                                <Badge variant={getSolverStatusVariant(schedule.solver_status)}>
                                  {getSolverStatusLabel(schedule.solver_status, result)}
                                </Badge>
                              )}
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
                          <div className="ml-4 flex items-center gap-2">
                            {schedule.status === 'closed' && (
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handlePublish(schedule.id); }}
                                isLoading={publishingId === schedule.id}
                                disabled={publishingId !== null}
                              >
                                <Send className="w-3.5 h-3.5 mr-1" />
                                Publish
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(schedule.id, schedule.name); }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-foreground-muted" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-foreground-muted" />
                            )}
                          </div>
                        </div>

                        {isExpanded && result && (
                          <div className="mt-4 pt-4 border-t border-border space-y-4">
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
                                              <Badge variant="default" className="text-xs">{dayAssignments.length} shifts</Badge>
                                            </div>
                                            <div className="space-y-1.5">
                                              {dayAssignments.map((assignment, idx) => (
                                                <div key={idx} className="flex items-center gap-3 p-2 bg-background-secondary rounded text-sm">
                                                  <div className="flex items-center gap-1.5 text-foreground-muted">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span>{formatMinutesToTime(assignment.start_minutes)} - {formatMinutesToTime(assignment.end_minutes)}</span>
                                                  </div>
                                                  <span className="font-medium text-foreground">{assignment.worker_name}</span>
                                                  <Badge variant="info" className="text-xs">{getPositionName(assignment.skill_id)}</Badge>
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

                            {result.coverage_gaps && result.coverage_gaps.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-warning mb-2">Coverage Gaps</h4>
                                <div className="space-y-1.5">
                                  {result.coverage_gaps.map((gap, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-2 bg-warning-muted/20 rounded text-sm">
                                      <AlertCircle className="w-4 h-4 text-warning" />
                                      <span className="text-foreground">
                                        Day {gap.day}: {formatMinutesToTime(gap.start_minutes)} - {formatMinutesToTime(gap.end_minutes)}
                                      </span>
                                      <Badge variant="warning" className="text-xs">{getPositionName(gap.skill_id)}</Badge>
                                      <span className="text-foreground-muted">{gap.assigned}/{gap.required} workers</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

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
          </>
        )}
      </div>
    </PageContainer>
  );
}
