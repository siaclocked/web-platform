'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';

import { Calendar, Users, Clock, MapPin, ChevronDown, ChevronUp, AlertCircle, Send, CheckCircle, ChevronLeft, ChevronRight, Plus, Trash2, Edit2, Save, BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

type ViewMode = 'month' | 'week' | 'grid' | 'list' | 'hours';

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
  coverage_gaps: Array<{ skill_id: string; day: number; start_minutes: number; end_minutes: number; required?: number; assigned?: number }>;
  diagnostics: string[];
  constraint_violations?: Array<{ code: string; message: string }>;
  validation_status?: 'VALID' | 'INVALID';
  manual_locked_assignments?: Array<{ worker_id: string; skill_id: string; day: number; start_minutes: number; end_minutes: number }>;
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

interface ScheduleTemplateResponse {
  templates: ScheduleTemplate[];
}

interface PlaceWorkersResponse {
  workers: Array<{
    id: string;
    first_name?: string;
    last_name?: string;
    skills?: Array<{ skill_id?: string; id?: string }>;
  }>;
}

interface WorkerHourData {
  id: string;
  name: string;
  monthly_min_hours: number | null;
  monthly_optimal_hours: number | null;
  hourly_rate: number | null;
  can_open: boolean;
  can_close: boolean;
  actual_hours: number;
  skills: Array<{ id: string; name: string; color: string; rating: number }>;
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
  const [viewingScheduleId, setViewingScheduleId] = useState<string | null>(null);
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
    startTimeStr: '09:00',
    endTimeStr: '17:00',
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
  const [workerHours, setWorkerHours] = useState<WorkerHourData[]>([]);
  const [isLoadingHours, setIsLoadingHours] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [calendarFilter, setCalendarFilter] = useState<'all' | 'published' | 'drafts' | 'empty'>('all');

  useEffect(() => {
    fetchAll();
  }, []);

  // Auto-expand schedule being reviewed
  useEffect(() => {
    if (reviewId && schedules.length > 0) {
      const target = schedules.find(s => s.id === reviewId);
      if (target) {
        setExpandedSchedule(reviewId);
        setSelectedPlaceId(target.place_id);
        setViewingScheduleId(reviewId);
        fetchWorkerHours(reviewId);
      }
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
        const data = (await response.json()) as ScheduleTemplateResponse;
        setSchedules(data.templates || []);
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

  const fetchWorkerHours = async (scheduleId: string) => {
    setIsLoadingHours(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/manager/schedule-templates/${scheduleId}/worker-hours`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setWorkerHours(data.workers || []);
      }
    } catch (error) {
      console.error('Error fetching worker hours:', error);
    } finally {
      setIsLoadingHours(false);
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
          const data = (await response.json()) as PlaceWorkersResponse;
          (data.workers || []).forEach((worker) => {
            if (seenIds.has(worker.id)) return;
            seenIds.add(worker.id);
            allWorkers.push({
              id: worker.id,
              name: `${worker.first_name || ''} ${worker.last_name || ''}`.trim() || 'Unknown',
              skill_ids: (worker.skills || [])
                .map((skill) => skill.skill_id || skill.id || '')
                .filter(Boolean),
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
    setAddShiftForm({ worker_id: '', skill_id: '', start_minutes: 540, end_minutes: 1020, startTimeStr: '09:00', endTimeStr: '17:00' });
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
        const data = await response.json();
        if (!silent) {
          if (data.is_valid) {
            alert('Schedule changes saved!');
            stopEditing();
          } else {
            alert('Schedule changes saved, but the draft is invalid and cannot be published until the violations are fixed.');
          }
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

  // Flatten schedules into a date-keyed map of shifts (filtered by viewingScheduleId when set)
  const flatShiftsByDate = useMemo(() => {
    const map: Record<string, FlatShift[]> = {};
    const seen = new Set<string>();
    const schedulesToShow = viewingScheduleId
      ? schedules.filter(s => s.id === viewingScheduleId)
      : schedules;
    schedulesToShow.forEach(s => {
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
  }, [schedules, places, viewingScheduleId]);

  // Build a date-keyed map of coverage gaps for the viewed schedule.
  // Recompute against current assignments to filter out gaps that are now covered
  // (e.g. a gap 10:00-16:00 is resolved by a shift 09:00-17:00 for the same skill).
  const gapsByDate = useMemo(() => {
    const map: Record<string, Array<{ skill_id: string; day: number; start_minutes: number; end_minutes: number; required?: number; assigned?: number }>> = {};
    if (!viewingScheduleId) return map;
    const schedule = schedules.find(s => s.id === viewingScheduleId);
    if (!schedule?.solver_result?.coverage_gaps) return map;
    const currentAssignments = schedule.solver_result.assignments || [];

    schedule.solver_result.coverage_gaps.forEach(gap => {
      const required = gap.required ?? 1;
      const SLOT = 30; // granularity in minutes

      // Check every slot in the gap window — gap is only resolved if
      // EVERY slot has enough covering assignments for this skill+day.
      let gapResolved = true;
      for (let m = gap.start_minutes; m < gap.end_minutes; m += SLOT) {
        const slotEnd = m + SLOT;
        const covering = currentAssignments.filter(a =>
          a.day === gap.day &&
          a.skill_id === gap.skill_id &&
          a.start_minutes < slotEnd &&
          a.end_minutes > m
        ).length;
        if (covering < required) {
          gapResolved = false;
          break;
        }
      }
      if (gapResolved) return;

      // Recount simple overlap for display
      const overlapping = currentAssignments.filter(a =>
        a.day === gap.day &&
        a.skill_id === gap.skill_id &&
        a.start_minutes < gap.end_minutes &&
        a.end_minutes > gap.start_minutes
      ).length;

      const startDate = new Date(schedule.start_date + 'T00:00:00');
      const gapDate = new Date(startDate);
      gapDate.setDate(gapDate.getDate() + gap.day);
      const dateStr = `${gapDate.getFullYear()}-${String(gapDate.getMonth() + 1).padStart(2, '0')}-${String(gapDate.getDate()).padStart(2, '0')}`;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push({ ...gap, assigned: overlapping });
    });
    return map;
  }, [schedules, viewingScheduleId]);

  // Flat list + count of active (unresolved) gaps from the recomputed gapsByDate
  const activeGaps = useMemo(() => {
    return Object.values(gapsByDate).flat();
  }, [gapsByDate]);
  const activeGapCount = activeGaps.length;

  // Compute active (unresolved) gap count for any schedule by checking current assignments
  const computeActiveGaps = (result: SolverResult | null): number => {
    if (!result?.coverage_gaps || !result.assignments) return 0;
    const SLOT = 30;
    let count = 0;
    for (const gap of result.coverage_gaps) {
      const required = gap.required ?? 1;
      let resolved = true;
      for (let m = gap.start_minutes; m < gap.end_minutes; m += SLOT) {
        const slotEnd = m + SLOT;
        const covering = result.assignments.filter(a =>
          a.day === gap.day &&
          a.skill_id === gap.skill_id &&
          a.start_minutes < slotEnd &&
          a.end_minutes > m
        ).length;
        if (covering < required) { resolved = false; break; }
      }
      if (!resolved) count++;
    }
    return count;
  };

  // Group schedules by place_id
  const schedulesByPlace = useMemo(() => {
    const map: Record<string, ScheduleTemplate[]> = {};
    schedules.forEach(s => {
      if (!map[s.place_id]) map[s.place_id] = [];
      map[s.place_id].push(s);
    });
    // Sort newest first (last saved wins)
    Object.values(map).forEach(arr => arr.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    ));
    return map;
  }, [schedules]);

  // For the selected place, compute date → winning schedule status
  // "Last saved is the real one" — newest updated_at wins for overlapping days
  const placeDateStatus = useMemo(() => {
    if (!selectedPlaceId) return {} as Record<string, { status: string; scheduleId: string; scheduleName: string }>;
    const placeSchedules = schedulesByPlace[selectedPlaceId] || [];
    const dateMap: Record<string, { status: string; scheduleId: string; scheduleName: string }> = {};
    // Process oldest first so newest overwrites
    const sorted = [...placeSchedules].sort((a, b) =>
      new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    );
    sorted.forEach(s => {
      const start = new Date(s.start_date + 'T00:00:00');
      const end = new Date(s.end_date + 'T00:00:00');
      const current = new Date(start);
      while (current <= end) {
        const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        dateMap[dateStr] = { status: s.status, scheduleId: s.id, scheduleName: s.name };
        current.setDate(current.getDate() + 1);
      }
    });
    return dateMap;
  }, [selectedPlaceId, schedulesByPlace]);

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

  const formatTimeInput = (raw: string, previous: string): string => {
    const digits = raw.replace(/\D/g, '');
    const capped = digits.slice(0, 4);
    if (capped.length === 0) return '';
    if (capped.length <= 2) {
      const h = parseInt(capped, 10);
      if (capped.length === 2 && h > 23) return previous;
      return capped;
    }
    const hh = capped.slice(0, 2);
    const mm = capped.slice(2);
    if (parseInt(hh, 10) > 23) return previous;
    if (mm.length === 2 && parseInt(mm, 10) > 59) return previous;
    return `${hh}:${mm}`;
  };

  const timeStrToMinutes = (timeStr: string): number => {
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
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

  const handleDirectPublish = async (scheduleId: string) => {
    if (!confirm('Publish this schedule directly? Solver validation will be skipped since you edited it manually. Team members will be notified of their assigned shifts.')) return;
    setPublishingId(scheduleId);
    try {
      // Save edits first
      const saved = await saveEdits(true);
      if (!saved) { setPublishingId(null); return; }
      stopEditing();

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/manager/schedule-templates/publish-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ schedule_template_id: scheduleId, skip_validation: true }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Schedule published! ${data.workers_notified} team member(s) notified.`);
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

  const handlePublish = async (scheduleId: string) => {
    if (!confirm('Publish this schedule? Team members will be notified of their assigned shifts.')) return;
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
        alert(`Schedule published! ${data.workers_notified} team member(s) notified.`);
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

  const viewingSchedule = viewingScheduleId ? schedules.find(s => s.id === viewingScheduleId) : null;

  return (
    <PageContainer>
      <div>
        {/* ========== PLACES LIST (top-level) ========== */}
        {!selectedPlaceId && !viewingScheduleId && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">Scheduling</h1>
              <p className="text-foreground-muted text-sm">Select a place to view and manage its schedules</p>
            </div>

            {places.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <MapPin className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
                  <h3 className="text-lg font-medium mb-2">No Places Found</h3>
                  <p className="text-foreground-muted mb-4">Add places first to start scheduling.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {places.map(place => {
                  const placeSchedules = schedulesByPlace[place.id] || [];
                  const publishedCount = placeSchedules.filter(s => s.status === 'schedule_published').length;
                  const draftCount = placeSchedules.filter(s => s.status === 'draft' || s.status === 'closed' || s.status === 'published').length;

                  return (
                    <Card
                      key={place.id}
                      className="cursor-pointer hover:border-primary/40 transition-all"
                      onClick={() => {
                        setSelectedPlaceId(place.id);
                        const now = new Date();
                        setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-5 h-5 text-primary" />
                              <h3 className="font-semibold text-foreground text-lg">{place.name}</h3>
                            </div>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              {publishedCount > 0 && (
                                <span className="text-sm text-success flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" /> {publishedCount} published
                                </span>
                              )}
                              {draftCount > 0 && (
                                <span className="text-sm text-warning flex items-center gap-1">
                                  <Edit2 className="w-3.5 h-3.5" /> {draftCount} draft{draftCount !== 1 ? 's' : ''}
                                </span>
                              )}
                              {placeSchedules.length === 0 && (
                                <span className="text-sm text-foreground-muted">No schedules yet</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link href={`/manager/schedule/create-schedule?place=${place.id}`} onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="outline">
                                <Plus className="w-3.5 h-3.5 mr-1" /> Create Schedule
                              </Button>
                            </Link>
                            <ChevronRight className="w-5 h-5 text-foreground-muted" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ========== PLACE CALENDAR VIEW ========== */}
        {selectedPlaceId && !viewingScheduleId && (() => {
          const place = places.find(p => p.id === selectedPlaceId);
          if (!place) return null;
          const placeSchedules = schedulesByPlace[selectedPlaceId] || [];
          const nowDate = new Date();
          nowDate.setHours(0, 0, 0, 0);
          const activeSchedules = placeSchedules.filter(s => new Date(s.end_date + 'T00:00:00') >= nowDate);
          const pastSchedules = placeSchedules.filter(s => new Date(s.end_date + 'T00:00:00') < nowDate);

          const getDayColor = (dateStr: string): 'published' | 'draft' | 'empty' => {
            const info = placeDateStatus[dateStr];
            if (!info) return 'empty';
            if (info.status === 'schedule_published') return 'published';
            return 'draft'; // draft, published (solver running), closed (ready to review)
          };

          const shouldHighlight = (color: 'published' | 'draft' | 'empty') => {
            if (calendarFilter === 'all') return true;
            return calendarFilter === color;
          };

          const renderScheduleCard = (schedule: ScheduleTemplate) => {
            const result = schedule.solver_result;
            const assignmentCount = result?.assignments?.length || 0;
            const gapCount = computeActiveGaps(result);
            const hasSolverResult = !!result && !!result.assignments;
            const isDraft = schedule.status === 'draft';

            const getStatusBadge = () => {
              if (schedule.status === 'schedule_published') return <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" />Published</Badge>;
              if (schedule.status === 'closed' && hasSolverResult) return <Badge variant="info">Ready to Review</Badge>;
              if (schedule.status === 'published') return <Badge variant="warning">Solver Running</Badge>;
              if (isDraft) return <Badge variant="default">Draft</Badge>;
              return <Badge variant={getSolverStatusVariant(schedule.solver_status)}>{getSolverStatusLabel(schedule.solver_status, result)}</Badge>;
            };

            const handleScheduleClick = () => {
              if (isDraft) {
                router.push(`/manager/schedule/create-schedule?id=${schedule.id}&place=${selectedPlaceId}`);
                return;
              }
              if (hasSolverResult) {
                setViewingScheduleId(schedule.id);
                const sd = new Date(schedule.start_date + 'T00:00:00');
                setCurrentMonth(new Date(sd.getFullYear(), sd.getMonth(), 1));
                fetchWorkerHours(schedule.id);
              }
            };

            return (
              <Card
                key={schedule.id}
                className={`transition-all ${hasSolverResult || isDraft ? 'cursor-pointer hover:border-primary/40' : ''}`}
                onClick={handleScheduleClick}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{schedule.name}</h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <div className="flex items-center gap-1 text-sm text-foreground-muted">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(schedule.start_date)} – {formatDate(schedule.end_date)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {getStatusBadge()}
                        {hasSolverResult && (
                          <span className="text-xs text-foreground-muted">{assignmentCount} shifts</span>
                        )}
                        {gapCount > 0 && (
                          <span className="text-xs text-warning flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {gapCount} gaps
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      {schedule.status === 'closed' && hasSolverResult && (
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); handlePublish(schedule.id); }} isLoading={publishingId === schedule.id} disabled={publishingId !== null}>
                          <Send className="w-3.5 h-3.5 mr-1" /> Publish
                        </Button>
                      )}
                      {schedule.status !== 'schedule_published' && (
                        <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(schedule.id, schedule.name); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {(hasSolverResult || isDraft) && <ChevronRight className="w-4 h-4 text-foreground-muted" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          };

          return (
            <>
              {/* Back + header */}
              <div className="flex items-center gap-3 mb-4">
                <Button variant="outline" size="sm" onClick={() => setSelectedPlaceId(null)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    <h1 className="text-xl font-bold text-foreground">{place.name}</h1>
                  </div>
                </div>
                <Link href={`/manager/schedule/create-schedule?place=${selectedPlaceId}`}>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" /> Create Schedule
                  </Button>
                </Link>
              </div>

              {/* View filter */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {(['all', 'published', 'drafts', 'empty'] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setCalendarFilter(filter)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                      ${calendarFilter === filter
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-foreground-muted hover:bg-background-secondary'
                      }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      filter === 'all' ? 'bg-primary' :
                      filter === 'published' ? 'bg-success' :
                      filter === 'drafts' ? 'bg-warning' :
                      'bg-foreground-muted/30'
                    }`} />
                    {filter === 'all' && 'All'}
                    {filter === 'published' && 'Published'}
                    {filter === 'drafts' && 'Drafts'}
                    {filter === 'empty' && 'Empty'}
                  </button>
                ))}
              </div>

              {/* Place Calendar */}
              <Card className="mb-6">
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
                      }} className="text-xs">Today</Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(mYear, mMonth + 1, 1))}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mb-3 text-xs text-foreground-muted">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-success/30 border border-success/50" /> Published</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-warning/30 border border-warning/50" /> Draft</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-foreground-muted/10 border border-border" /> Empty</span>
                  </div>

                  <div className="grid grid-cols-7 mb-1">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                      <div key={d} className="text-center text-xs font-semibold text-foreground-muted py-2">{d}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {calendarDays.map((cell, idx) => {
                      const dayColor = getDayColor(cell.dateStr);
                      const highlight = shouldHighlight(dayColor);
                      const isToday = cell.dateStr === todayStr;
                      const info = placeDateStatus[cell.dateStr];

                      let cellBg = '';
                      let cellBorder = 'border-border/50';
                      let cellText = '';

                      if (cell.isCurrentMonth && highlight) {
                        if (dayColor === 'published') {
                          cellBg = 'bg-success/15';
                          cellBorder = 'border-success/40';
                          cellText = 'text-success';
                        } else if (dayColor === 'draft') {
                          cellBg = 'bg-warning/15';
                          cellBorder = 'border-warning/40';
                          cellText = 'text-warning';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (!cell.isCurrentMonth) return;
                            if (info) {
                              // Click on a scheduled day → open that schedule
                              const sched = schedules.find(s => s.id === info.scheduleId);
                              if (sched) {
                                if (sched.status === 'draft') {
                                  router.push(`/manager/schedule/create-schedule?id=${sched.id}&place=${selectedPlaceId}`);
                                } else if (sched.solver_result?.assignments) {
                                  setViewingScheduleId(sched.id);
                                  setSelectedDate(cell.dateStr);
                                  fetchWorkerHours(sched.id);
                                }
                              }
                            }
                          }}
                          className={`relative flex flex-col items-start p-2 min-h-[72px] border text-left transition-all hover:scale-[1.02]
                            ${cellBg} ${cellBorder}
                            ${!cell.isCurrentMonth ? 'text-foreground-muted/30' : 'text-foreground'}
                            ${cell.isCurrentMonth && info ? 'cursor-pointer hover:bg-background-secondary' : ''}
                            ${cell.isCurrentMonth && !info ? 'cursor-default' : ''}`}
                        >
                          <span className={`text-sm font-semibold ${isToday ? 'bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                            {cell.day}
                          </span>
                          {cell.isCurrentMonth && highlight && dayColor === 'published' && (
                            <span className="mt-auto text-[10px] text-success font-medium truncate w-full text-center">
                              Published
                            </span>
                          )}
                          {cell.isCurrentMonth && highlight && dayColor === 'draft' && (
                            <span className="mt-auto text-[10px] text-warning font-medium truncate w-full text-center">
                              Draft
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Active Schedules */}
              {activeSchedules.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-foreground mb-3">Active Schedules</h2>
                  <div className="space-y-2">
                    {activeSchedules.map(renderScheduleCard)}
                  </div>
                </div>
              )}

              {/* Past Schedules */}
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Past Schedules</h2>
                {pastSchedules.length === 0 ? (
                  <Card>
                    <CardContent className="py-6 text-center">
                      <p className="text-sm text-foreground-muted">No past schedules for this place.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {pastSchedules.map(renderScheduleCard)}
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* ========== INDIVIDUAL SCHEDULE VIEW ========== */}
        {viewingScheduleId && viewingSchedule && (
          <>
            {/* Back + header */}
            <div className="flex items-center gap-3 mb-2">
              <Button variant="outline" size="sm" onClick={() => {
                setViewingScheduleId(null);
                setSelectedDate(null);
                stopEditing();
              }}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                {getPlaceName(viewingSchedule.place_id)}
              </Button>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-foreground">{viewingSchedule.name}</h1>
                <div className="flex items-center gap-2 text-sm text-foreground-muted">
                  <MapPin className="w-3.5 h-3.5" />
                  {getPlaceName(viewingSchedule.place_id)}
                  <span>·</span>
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(viewingSchedule.start_date)} – {formatDate(viewingSchedule.end_date)}
                  <span>·</span>
                  {viewingSchedule.status === 'schedule_published' ? (
                    <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" />Published</Badge>
                  ) : (
                    <Badge variant={getSolverStatusVariant(viewingSchedule.solver_status)}>
                      {getSolverStatusLabel(viewingSchedule.solver_status, viewingSchedule.solver_result)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Review banner */}
            {reviewId && viewingScheduleId === reviewId && (() => {
              const assignments = viewingSchedule.solver_result?.assignments?.length || 0;
              const isFeasible = viewingSchedule.solver_result?.status === 'OPTIMAL' || viewingSchedule.solver_result?.status === 'FEASIBLE';
              return (
                <Card className={`mb-4 border-l-4 ${isFeasible && activeGapCount === 0 ? 'border-l-success' : 'border-l-warning'}`}>
                  <CardContent className="p-4">
                    <p className="text-sm text-foreground-muted">
                      {assignments} shift{assignments !== 1 ? 's' : ''} assigned
                      {activeGapCount > 0 && <span className="text-warning ml-2">· {activeGapCount} coverage gap{activeGapCount !== 1 ? 's' : ''}</span>}
                      {activeGapCount === 0 && <span className="text-success ml-2">· No gaps — ready to publish</span>}
                    </p>
                    {viewingSchedule.status === 'closed' && !isEditing && (
                      <Button size="sm" className="mt-2" onClick={() => handlePublish(viewingSchedule.id)} isLoading={publishingId === viewingSchedule.id}>
                        <Send className="w-3.5 h-3.5 mr-1" />
                        Approve & Send to Team
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Stat strip — summary tiles */}
            {viewingSchedule.solver_result && (() => {
              const result = viewingSchedule.solver_result;
              const assignments = result.assignments?.length || 0;
              const totalHours = Object.values(result.total_hours_by_worker || {}).reduce((s, h) => s + h, 0);
              const uniqueWorkers = new Set(result.assignments?.map(a => a.worker_id)).size;
              const startDate = new Date(viewingSchedule.start_date + 'T00:00:00');
              const endDate = new Date(viewingSchedule.end_date + 'T00:00:00');
              const dayCount = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const isFeasible = result.status === 'OPTIMAL' || result.status === 'FEASIBLE';
              const lockedCount = result.manual_locked_assignments?.length || 0;

              const tiles = [
                { label: 'Status', value: isFeasible ? (activeGapCount === 0 ? 'Ready' : 'Partial') : 'Issues', tone: isFeasible && activeGapCount === 0 ? 'ok' : activeGapCount > 0 ? 'warn' : 'bad' },
                { label: 'Shifts', value: assignments, hint: lockedCount > 0 ? `${lockedCount} locked` : undefined },
                { label: 'Team', value: uniqueWorkers, hint: `over ${dayCount} day${dayCount !== 1 ? 's' : ''}` },
                { label: 'Hours', value: totalHours.toFixed(1), hint: assignments > 0 ? `avg ${(totalHours / uniqueWorkers).toFixed(1)}/team member` : undefined },
                { label: 'Gaps', value: activeGapCount, tone: activeGapCount === 0 ? 'ok' : 'warn' },
                { label: 'Solve time', value: result.solve_time_ms ? `${(result.solve_time_ms / 1000).toFixed(1)}s` : '—' },
              ];

              return (
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
                  {tiles.map((t, i) => (
                    <Card key={i} className="border border-border">
                      <CardContent className="p-3">
                        <div className="text-[10px] uppercase tracking-wide text-foreground-muted font-semibold">{t.label}</div>
                        <div className={`text-xl font-bold mt-1 ${t.tone === 'ok' ? 'text-success' : t.tone === 'warn' ? 'text-warning' : t.tone === 'bad' ? 'text-danger' : 'text-foreground'}`}>
                          {t.value}
                        </div>
                        {t.hint && <div className="text-[10px] text-foreground-muted mt-0.5">{t.hint}</div>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()}

            {/* Page-level gap banner */}
            {activeGapCount > 0 && viewingSchedule.solver_result && (
              <Card className="mb-4 border-l-4 border-l-warning bg-warning/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-foreground">
                        {activeGapCount} coverage gap{activeGapCount !== 1 ? 's' : ''} need{activeGapCount === 1 ? 's' : ''} attention
                      </h3>
                      <p className="text-xs text-foreground-muted">
                        Click a day below to assign team members, or edit existing shifts to extend their hours.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                    {Object.entries(gapsByDate).slice(0, 6).map(([date, gaps]) => (
                      <div key={date} className="text-xs p-2 rounded bg-background border border-warning/30">
                        <div className="font-semibold text-foreground">
                          {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                        {gaps.map((g, i) => {
                          const req = g.required ?? 1;
                          const have = g.assigned ?? 0;
                          return (
                            <div key={i} className="text-foreground-muted mt-0.5">
                              {getPositionName(g.skill_id)} · {formatMinutesToTime(g.start_minutes)}–{formatMinutesToTime(g.end_minutes)} · need {req}, have {have}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {Object.keys(gapsByDate).length > 6 && (
                    <p className="text-[11px] text-foreground-muted mt-2">
                      …and {Object.keys(gapsByDate).length - 6} more day{Object.keys(gapsByDate).length - 6 !== 1 ? 's' : ''} with gaps. See Month View for the full list.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Top bar — edit/save/view mode */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {!isEditing && viewingSchedule.solver_result && (
                  <Button variant="outline" onClick={() => startEditing(viewingScheduleId)}>
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
                {!isEditing && viewingSchedule.status === 'closed' && (
                  <Button onClick={() => handlePublish(viewingSchedule.id)} isLoading={publishingId === viewingSchedule.id}>
                    <Send className="w-4 h-4 mr-1" />
                    Publish
                  </Button>
                )}
              </div>
              <div className="relative">
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as ViewMode)}
                  className="text-sm py-2 pl-3 pr-8 border border-border rounded-lg bg-background text-foreground appearance-none cursor-pointer"
                >
                  <option value="month">Month View</option>
                  <option value="week">Week View</option>
                  <option value="grid">Grid View</option>
                  <option value="hours">Hour Targets</option>
                  <option value="list">List View</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
              </div>
            </div>

            {/* Editing banner */}
            {isEditing && (() => {
              const editSchedule = schedules.find(s => s.id === editingScheduleId);
              const assignmentCount = editSchedule?.solver_result?.assignments?.length || 0;
              const isReady = activeGapCount === 0 && assignmentCount > 0;

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
                        <><strong>Editing mode:</strong> Click a day to add/remove shifts. {activeGapCount > 0 && <span className="text-warning">{activeGapCount} coverage gap{activeGapCount !== 1 ? 's' : ''} remaining.</span>}</>
                      )}
                    </span>
                  </div>
                  {isReady && editSchedule && editSchedule.status !== 'schedule_published' && (
                    <Button size="sm" onClick={() => handleDirectPublish(editSchedule.id)} isLoading={savingEdits || publishingId === editSchedule.id}>
                      <Send className="w-3.5 h-3.5 mr-1" />
                      Publish to Team
                    </Button>
                  )}
                </div>
              );
            })()}

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
                        const gaps = gapsByDate[cell.dateStr] || [];
                        const isToday = cell.dateStr === todayStr;
                        const isSelected = cell.dateStr === selectedDate;
                        const hasShifts = shifts.length > 0;
                        const hasGaps = gaps.length > 0;
                        const gapHours = gaps.reduce((sum, g) => sum + (g.end_minutes - g.start_minutes) / 60, 0);

                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedDate(isSelected ? null : cell.dateStr)}
                            className={`relative flex flex-col items-start p-2 min-h-[80px] border text-left transition-all hover:scale-[1.02]
                              ${hasGaps && cell.isCurrentMonth ? 'border-danger/40 bg-danger/5' : ''}
                              ${hasShifts && !hasGaps && cell.isCurrentMonth ? 'border-success/40 bg-success/5' : ''}
                              ${!hasShifts && !hasGaps ? 'border-border/50' : ''}
                              ${isSelected ? 'ring-2 ring-primary/40 bg-primary/5' : ''}
                              ${!cell.isCurrentMonth ? 'text-foreground-muted/40' : 'text-foreground'}
                              ${cell.isCurrentMonth && !hasShifts && !hasGaps ? 'hover:bg-background-secondary' : ''}`}
                          >
                            <span className={`text-sm font-semibold ${isToday ? 'bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                              {cell.day}
                            </span>
                            {hasGaps && cell.isCurrentMonth && (
                              <span className="mt-auto text-[10px] text-danger font-semibold bg-danger/10 border border-danger/20 rounded px-1 py-0.5 truncate w-full text-center">
                                {gapHours.toFixed(1)}h gap
                              </span>
                            )}
                            {hasShifts && !hasGaps && cell.isCurrentMonth && (
                              <span className="mt-auto text-[10px] text-success font-medium truncate w-full text-center">
                                {shifts.length} shift{shifts.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {selectedDate && (() => {
                  const dayGaps = gapsByDate[selectedDate] || [];
                  const hasGapsToday = dayGaps.length > 0;
                  const shifts = selectedDayShifts;

                  // Group shifts by skill for Gantt
                  const skillGroups: Record<string, FlatShift[]> = {};
                  shifts.forEach(s => {
                    const skillName = getPositionName(s.skill_id);
                    if (!skillGroups[skillName]) skillGroups[skillName] = [];
                    skillGroups[skillName].push(s);
                  });

                  // Group gaps by skill for Gantt
                  const gapGroups: Record<string, typeof dayGaps> = {};
                  dayGaps.forEach(g => {
                    const skillName = getPositionName(g.skill_id);
                    if (!gapGroups[skillName]) gapGroups[skillName] = [];
                    gapGroups[skillName].push(g);
                  });
                  // Ensure gap-only skills also appear in skillGroups
                  Object.keys(gapGroups).forEach(name => {
                    if (!skillGroups[name]) skillGroups[name] = [];
                  });

                  // Find time range for axis
                  const allMinutes = shifts.flatMap(s => [s.start_minutes, s.end_minutes]);
                  const gapMinutes = dayGaps.flatMap(g => [g.start_minutes, g.end_minutes]);
                  const allTimes = [...allMinutes, ...gapMinutes];
                  const minTime = allTimes.length > 0 ? Math.min(...allTimes) : 480;
                  const maxTime = allTimes.length > 0 ? Math.max(...allTimes) : 1200;
                  // Round to full hours
                  const axisStart = Math.floor(minTime / 60) * 60;
                  const axisEnd = Math.ceil(maxTime / 60) * 60;
                  const axisRange = axisEnd - axisStart || 60;

                  const pct = (m: number) => ((m - axisStart) / axisRange) * 100;
                  const pctW = (s: number, e: number) => ((e - s) / axisRange) * 100;

                  // Worker colors
                  const COLORS = ['#2563eb','#dc2626','#16a34a','#d97706','#7c3aed','#db2777','#0d9488','#ea580c','#0891b2','#4f46e5','#65a30d','#be123c'];
                  const workerColorMap: Record<string, string> = {};
                  let colorIdx = 0;
                  shifts.forEach(s => {
                    if (!workerColorMap[s.worker_id]) {
                      workerColorMap[s.worker_id] = COLORS[colorIdx % COLORS.length];
                      colorIdx++;
                    }
                  });

                  // Time axis ticks (hourly)
                  const ticks: number[] = [];
                  for (let t = axisStart; t <= axisEnd; t += 60) ticks.push(t);

                  return (
                  <Card className={`border-l-4 ${hasGapsToday ? 'border-l-danger' : shifts.length > 0 ? 'border-l-success' : 'border-l-border'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-foreground">
                            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </h3>
                          {hasGapsToday ? (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-danger/10 text-danger border border-danger/20">
                              {dayGaps.length} gap{dayGaps.length !== 1 ? 's' : ''}
                            </span>
                          ) : shifts.length > 0 ? (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-success/10 text-success border border-success/20">
                              ✓ Fully covered
                            </span>
                          ) : null}
                        </div>
                        {isEditing && (
                          <Button size="sm" variant="outline" onClick={() => setShowAddShift(!showAddShift)}>
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add Shift
                          </Button>
                        )}
                      </div>

                      {isEditing && showAddShift && editingScheduleId && (() => {
                        const selectedWorker = availableWorkers.find(w => w.id === addShiftForm.worker_id);
                        const workerPositions = selectedWorker
                          ? positions.filter(p => selectedWorker.skill_ids.includes(p.id))
                          : [];
                        const startValid = addShiftForm.startTimeStr.length === 5;
                        const endValid = addShiftForm.endTimeStr.length === 5;
                        const sMin = timeStrToMinutes(addShiftForm.startTimeStr);
                        const eMin = timeStrToMinutes(addShiftForm.endTimeStr);
                        const timeValid = startValid && endValid && eMin > sMin;

                        return (
                        <div className="mb-4 p-3 border border-primary/30 bg-primary-muted/10 rounded-lg space-y-3">
                          <h4 className="text-sm font-medium text-foreground">Add Team Member to This Day</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-foreground-muted mb-1">Team Member</label>
                              <select value={addShiftForm.worker_id} onChange={(e) => setAddShiftForm(f => ({ ...f, worker_id: e.target.value, skill_id: '' }))} className="w-full p-2 border border-border rounded text-sm bg-background text-foreground">
                                <option value="">Select worker...</option>
                                {availableWorkers.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-foreground-muted mb-1">Position</label>
                              <select value={addShiftForm.skill_id} onChange={(e) => setAddShiftForm(f => ({ ...f, skill_id: e.target.value }))} className="w-full p-2 border border-border rounded text-sm bg-background text-foreground" disabled={!addShiftForm.worker_id}>
                                <option value="">{addShiftForm.worker_id ? 'Select position...' : 'Select a worker first'}</option>
                                {workerPositions.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-foreground-muted mb-1">Start Time</label>
                              <input type="text" inputMode="numeric" value={addShiftForm.startTimeStr} onChange={(e) => { const val = formatTimeInput(e.target.value, addShiftForm.startTimeStr); setAddShiftForm(f => ({ ...f, startTimeStr: val, start_minutes: timeStrToMinutes(val) })); }} placeholder="09:00" maxLength={5} className="w-full p-2 border border-border rounded text-sm bg-background text-foreground text-center font-mono" />
                            </div>
                            <div>
                              <label className="block text-xs text-foreground-muted mb-1">End Time</label>
                              <input type="text" inputMode="numeric" value={addShiftForm.endTimeStr} onChange={(e) => { const val = formatTimeInput(e.target.value, addShiftForm.endTimeStr); setAddShiftForm(f => ({ ...f, endTimeStr: val, end_minutes: timeStrToMinutes(val) })); }} placeholder="17:00" maxLength={5} className="w-full p-2 border border-border rounded text-sm bg-background text-foreground text-center font-mono" />
                            </div>
                          </div>
                          {startValid && endValid && !timeValid && (<p className="text-xs text-danger">End time must be after start time</p>)}
                          <div className="flex gap-2">
                            <Button size="sm" disabled={!addShiftForm.worker_id || !addShiftForm.skill_id || !timeValid} onClick={() => addManualShift(editingScheduleId, selectedDate)}>
                              <Plus className="w-3.5 h-3.5 mr-1" />Add
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setShowAddShift(false)}>Cancel</Button>
                          </div>
                        </div>
                        );
                      })()}

                      {/* Coverage gaps */}
                      {hasGapsToday && (
                        <div className="mb-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                          <h4 className="text-sm font-medium text-warning mb-2 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />Coverage Gaps ({dayGaps.length})
                          </h4>
                          <div className="space-y-1.5">
                            {dayGaps.map((gap, gIdx) => (
                              <div key={gIdx} className="flex items-center gap-2 text-sm">
                                <Clock className="w-3.5 h-3.5 text-warning" />
                                <span className="text-foreground">{formatMinutesToTime(gap.start_minutes)} – {formatMinutesToTime(gap.end_minutes)}</span>
                                <Badge variant="warning" className="text-xs">{getPositionName(gap.skill_id)}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Gantt Chart */}
                      {shifts.length === 0 && dayGaps.length === 0 && !showAddShift ? (
                        <p className="text-sm text-foreground-muted py-2">No shifts scheduled.</p>
                      ) : (shifts.length > 0 || dayGaps.length > 0) && (
                        <div className="border border-border rounded-lg overflow-hidden bg-background-secondary">
                          {Object.entries(skillGroups).map(([skillName, groupShifts]) => {
                            const skillGaps = gapGroups[skillName] || [];
                            const barHeight = 32;
                            const barGap = 4;
                            const shiftRows = groupShifts.length;
                            const gapRows = skillGaps.length;
                            const totalHeight = (shiftRows + gapRows) * (barHeight + barGap) + barGap;

                            return (
                              <div key={skillName} className="flex border-b border-border last:border-b-0">
                                <div className="w-20 min-w-[80px] flex items-center justify-center bg-background border-r border-border px-2" style={{ height: totalHeight }}>
                                  <span className="text-xs font-bold text-foreground-muted text-center">{skillName}</span>
                                </div>
                                <div className="flex-1 relative" style={{ height: totalHeight }}>
                                  {/* Shift bars */}
                                  {groupShifts.map((shift, sIdx) => {
                                    const color = workerColorMap[shift.worker_id] || '#888';
                                    const left = pct(shift.start_minutes);
                                    const width = pctW(shift.start_minutes, shift.end_minutes);
                                    const top = barGap + sIdx * (barHeight + barGap);
                                    const dur = ((shift.end_minutes - shift.start_minutes) / 60).toFixed(1);

                                    return (
                                      <div
                                        key={`${shift.worker_id}-${sIdx}`}
                                        className="absolute flex items-center gap-1.5 px-2 rounded overflow-hidden whitespace-nowrap"
                                        style={{
                                          left: `${left}%`,
                                          width: `${width}%`,
                                          top,
                                          height: barHeight,
                                          background: `${color}18`,
                                          borderLeft: `3px solid ${color}`,
                                        }}
                                        title={`${shift.worker_name}: ${formatMinutesToTime(shift.start_minutes)}–${formatMinutesToTime(shift.end_minutes)} (${dur}h)`}
                                      >
                                        <span className="text-xs font-bold truncate" style={{ color }}>{shift.worker_name}</span>
                                        <span className="text-[10px] text-foreground-muted hidden sm:inline">{formatMinutesToTime(shift.start_minutes)}–{formatMinutesToTime(shift.end_minutes)}</span>
                                        <span className="text-[10px] bg-background/60 px-1 rounded hidden sm:inline">{dur}h</span>
                                        {isEditing && (
                                          <div className="ml-auto flex items-center gap-0.5 shrink-0">
                                            <button onClick={() => setEditingShift({ scheduleId: shift.schedule_id, workerId: shift.worker_id, day: shift.day, origStart: shift.start_minutes, origEnd: shift.end_minutes, skillId: shift.skill_id, newStart: shift.start_minutes, newEnd: shift.end_minutes })} className="p-0.5 hover:bg-white/40 rounded"><Edit2 className="w-3 h-3" style={{ color }} /></button>
                                            <button onClick={() => removeShift(shift.schedule_id, shift.worker_id, shift.day, shift.start_minutes, shift.end_minutes, shift.skill_id)} className="p-0.5 hover:bg-white/40 rounded"><Trash2 className="w-3 h-3 text-danger" /></button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {/* Gap bars (dashed red, below shift bars) */}
                                  {skillGaps.map((gap, gIdx) => {
                                    const left = pct(gap.start_minutes);
                                    const width = pctW(gap.start_minutes, gap.end_minutes);
                                    const top = barGap + (shiftRows + gIdx) * (barHeight + barGap);
                                    const req = gap.required ?? 1;
                                    const have = gap.assigned ?? 0;

                                    return (
                                      <div
                                        key={`gap-${gIdx}`}
                                        className="absolute flex items-center gap-1 px-2 rounded overflow-hidden whitespace-nowrap"
                                        style={{
                                          left: `${left}%`,
                                          width: `${width}%`,
                                          top,
                                          height: barHeight,
                                          background: '#fef2f2',
                                          border: '1px dashed #fca5a5',
                                          color: '#dc2626',
                                          zIndex: 1,
                                        }}
                                        title={`Gap: ${formatMinutesToTime(gap.start_minutes)}–${formatMinutesToTime(gap.end_minutes)} (need ${req}, have ${have})`}
                                      >
                                        <AlertCircle className="w-3 h-3 shrink-0" />
                                        <span className="text-[11px] font-semibold">GAP</span>
                                        <span className="text-[10px]">{formatMinutesToTime(gap.start_minutes)}–{formatMinutesToTime(gap.end_minutes)}</span>
                                        <span className="text-[10px] hidden sm:inline">need {req}, have {have}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          {/* Time axis */}
                          <div className="flex border-t border-border bg-background">
                            <div className="w-20 min-w-[80px]" />
                            <div className="flex-1 relative h-6">
                              {ticks.map(t => (
                                <span key={t} className="absolute text-[10px] text-foreground-muted font-medium" style={{ left: `${pct(t)}%`, transform: 'translateX(-50%)', top: 4 }}>
                                  {formatMinutesToTime(t)}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Inline shift edit form */}
                      {isEditing && editingShift && (
                        <div className="mt-3 p-3 border border-primary/30 bg-primary-muted/10 rounded-lg">
                          <h4 className="text-xs font-medium text-foreground mb-2">
                            Edit Shift — {selectedDayShifts.find(s => s.worker_id === editingShift.workerId && s.start_minutes === editingShift.origStart)?.worker_name}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div>
                              <label className="block text-xs text-foreground-muted mb-1">Start</label>
                              <input type="time" value={formatMinutesToTime(editingShift.newStart)} onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); if (!isNaN(h) && !isNaN(m)) setEditingShift(prev => prev ? { ...prev, newStart: h * 60 + m } : null); }} className="p-1.5 border border-border rounded text-sm bg-background text-foreground" />
                            </div>
                            <div>
                              <label className="block text-xs text-foreground-muted mb-1">End</label>
                              <input type="time" value={formatMinutesToTime(editingShift.newEnd)} onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); if (!isNaN(h) && !isNaN(m)) setEditingShift(prev => prev ? { ...prev, newEnd: h * 60 + m } : null); }} className="p-1.5 border border-border rounded text-sm bg-background text-foreground" />
                            </div>
                            <div className="flex items-end gap-1 pb-0.5">
                              <Button size="sm" onClick={() => { if (editingShift.newEnd <= editingShift.newStart) { alert('End time must be after start time'); return; } updateShiftTimes(editingShift.scheduleId, editingShift.workerId, editingShift.day, editingShift.origStart, editingShift.origEnd, editingShift.skillId, editingShift.newStart, editingShift.newEnd); }}>
                                <Save className="w-3 h-3 mr-1" />Apply
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingShift(null)}>Cancel</Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })()}
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

            {/* ===== GRID VIEW (workers × days) ===== */}
            {viewMode === 'grid' && (() => {
              // Unique workers from all shifts in the schedule, sorted by name
              const workerMap = new Map<string, { id: string; name: string }>();
              Object.values(flatShiftsByDate).forEach(arr => {
                arr.forEach(s => {
                  if (!workerMap.has(s.worker_id)) {
                    workerMap.set(s.worker_id, { id: s.worker_id, name: s.worker_name });
                  }
                });
              });
              const workers = Array.from(workerMap.values()).sort((a, b) => a.name.localeCompare(b.name));

              // Locked assignment lookup: worker_id + day → true
              const lockedSet = new Set(
                (viewingSchedule.solver_result?.manual_locked_assignments || []).map(
                  l => `${l.worker_id}-${l.day}-${l.start_minutes}-${l.end_minutes}`
                )
              );

              // Per-worker hours within the week
              const weekHoursByWorker = new Map<string, number>();
              workers.forEach(w => {
                let hours = 0;
                weekDays.forEach(dateStr => {
                  (flatShiftsByDate[dateStr] || [])
                    .filter(s => s.worker_id === w.id)
                    .forEach(s => { hours += (s.end_minutes - s.start_minutes) / 60; });
                });
                weekHoursByWorker.set(w.id, hours);
              });

              return (
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

                  {workers.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8 text-foreground-muted text-sm">
                        No team members assigned in this schedule yet.
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr>
                              <th className="sticky left-0 bg-background-secondary border-b border-r border-border text-left p-2 font-semibold text-foreground-muted uppercase tracking-wide text-[10px] min-w-[160px]">
                                Team Member
                              </th>
                              {weekDays.map(dateStr => {
                                const dt = new Date(dateStr + 'T00:00:00');
                                const isToday = dateStr === todayStr;
                                const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                                return (
                                  <th
                                    key={dateStr}
                                    className={`border-b border-border p-2 font-semibold text-[10px] uppercase tracking-wide min-w-[90px] ${isToday ? 'text-primary' : 'text-foreground-muted'} ${isWeekend ? 'bg-warning/5' : 'bg-background-secondary'}`}
                                  >
                                    <div>{dt.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                    <div className={`text-sm mt-0.5 ${isToday ? 'text-primary font-bold' : 'text-foreground'}`}>
                                      {dt.getDate()}
                                    </div>
                                  </th>
                                );
                              })}
                              <th className="border-b border-l border-border p-2 font-semibold text-foreground-muted uppercase tracking-wide text-[10px] min-w-[60px] bg-background-secondary">
                                Hours
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {workers.map(worker => {
                              const totalHours = weekHoursByWorker.get(worker.id) || 0;
                              return (
                                <tr key={worker.id} className="hover:bg-background-secondary/50">
                                  <td className="sticky left-0 bg-background border-b border-r border-border p-2 font-semibold text-foreground">
                                    {worker.name}
                                  </td>
                                  {weekDays.map(dateStr => {
                                    const dt = new Date(dateStr + 'T00:00:00');
                                    const dayIdx = Math.round(
                                      (dt.getTime() - new Date(viewingSchedule.start_date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)
                                    );
                                    const dayShifts = (flatShiftsByDate[dateStr] || []).filter(s => s.worker_id === worker.id);
                                    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;

                                    if (dayShifts.length === 0) {
                                      return (
                                        <td
                                          key={dateStr}
                                          className={`border-b border-border p-2 text-center text-foreground-muted/40 ${isWeekend ? 'bg-warning/5' : ''}`}
                                        >
                                          —
                                        </td>
                                      );
                                    }

                                    return (
                                      <td
                                        key={dateStr}
                                        className={`border-b border-border p-1.5 align-top ${isWeekend ? 'bg-warning/5' : ''}`}
                                      >
                                        <div className="space-y-1">
                                          {dayShifts.map((s, i) => {
                                            const isLocked = lockedSet.has(`${s.worker_id}-${dayIdx}-${s.start_minutes}-${s.end_minutes}`);
                                            return (
                                              <div
                                                key={i}
                                                className={`px-1.5 py-1 rounded text-[10px] font-semibold border ${
                                                  isLocked
                                                    ? 'bg-warning/15 text-warning-foreground border-warning/50'
                                                    : 'bg-success/15 text-success border-success/40'
                                                }`}
                                                title={`${getPositionName(s.skill_id)} · ${formatMinutesToTime(s.start_minutes)}–${formatMinutesToTime(s.end_minutes)}${isLocked ? ' · LOCKED' : ''}`}
                                              >
                                                <div className="leading-tight">
                                                  {formatMinutesToTime(s.start_minutes)}–{formatMinutesToTime(s.end_minutes)}
                                                </div>
                                                <div className="text-[9px] font-medium opacity-75 mt-0.5 truncate">
                                                  {isLocked && '🔒 '}{getPositionName(s.skill_id)}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </td>
                                    );
                                  })}
                                  <td className="border-b border-l border-border p-2 text-center font-bold text-foreground bg-background-secondary">
                                    {totalHours.toFixed(1)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-foreground-muted">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-success/30 border border-success/50" />
                      Scheduled
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-warning/30 border border-warning/50" />
                      🔒 Locked (manual)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-warning/5 border border-border" />
                      Weekend
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ===== HOUR TARGETS VIEW ===== */}
            {viewMode === 'hours' && (() => {
              if (isLoadingHours) {
                return (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                );
              }

              if (workerHours.length === 0) {
                return (
                  <Card>
                    <CardContent className="text-center py-8">
                      <BarChart3 className="w-10 h-10 mx-auto mb-3 text-foreground-muted" />
                      <p className="text-foreground-muted">No worker hour data available for this schedule.</p>
                    </CardContent>
                  </Card>
                );
              }

              const maxActual = Math.max(...workerHours.map(w => w.actual_hours), 1);
              const COLORS = ['#2563eb','#dc2626','#16a34a','#d97706','#7c3aed','#db2777','#0d9488','#ea580c','#0891b2','#4f46e5','#65a30d','#be123c'];

              // Totals
              const totalMin = workerHours.reduce((sum, w) => sum + (w.monthly_min_hours || 0), 0);
              const totalOptimal = workerHours.reduce((sum, w) => sum + (w.monthly_optimal_hours || 0), 0);
              const totalActual = workerHours.reduce((sum, w) => sum + w.actual_hours, 0);

              // Group by skill for subtotals
              const skillTotals: Record<string, number> = {};
              workerHours.forEach(w => {
                (w.skills || []).forEach(s => {
                  // Calculate hours for this worker under this skill
                  const result = viewingSchedule?.solver_result;
                  if (result?.assignments) {
                    const skillHours = result.assignments
                      .filter(a => a.worker_id === w.id && a.skill_id === s.id)
                      .reduce((sum, a) => sum + (a.end_minutes - a.start_minutes) / 60, 0);
                    skillTotals[s.name] = (skillTotals[s.name] || 0) + skillHours;
                  }
                });
              });

              return (
                <div className="space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        <h2 className="font-bold text-foreground text-lg">Monthly Hour Targets — Min / Optimal vs Actual</h2>
                      </div>
                      <p className="text-sm text-foreground-muted mb-5">
                        The solver schedules each worker close to their <strong>optimal</strong> target and never significantly below their <strong>minimum</strong> target.
                      </p>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b-2 border-border">
                              <th className="text-left py-2 px-3 text-xs font-semibold text-foreground-muted uppercase tracking-wider">Team Member</th>
                              <th className="text-left py-2 px-3 text-xs font-semibold text-foreground-muted uppercase tracking-wider">Position</th>
                              <th className="text-center py-2 px-3 text-xs font-semibold text-foreground-muted uppercase tracking-wider">Min Target</th>
                              <th className="text-center py-2 px-3 text-xs font-semibold text-foreground-muted uppercase tracking-wider">Optimal Target</th>
                              <th className="text-center py-2 px-3 text-xs font-semibold text-foreground-muted uppercase tracking-wider">Actual Hours</th>
                              <th className="text-center py-2 px-3 text-xs font-semibold text-foreground-muted uppercase tracking-wider">vs Min</th>
                              <th className="text-center py-2 px-3 text-xs font-semibold text-foreground-muted uppercase tracking-wider">vs Optimal</th>
                              <th className="py-2 px-3 text-xs font-semibold text-foreground-muted uppercase tracking-wider w-[180px]">Bar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {workerHours.map((w, wIdx) => {
                              const minH = w.monthly_min_hours || 0;
                              const optH = w.monthly_optimal_hours || 0;
                              const deltaMin = w.actual_hours - minH;
                              const deltaOpt = w.actual_hours - optH;
                              const barWidth = maxActual > 0 ? (w.actual_hours / maxActual) * 100 : 0;
                              const color = COLORS[wIdx % COLORS.length];
                              const skillNames = (w.skills || []).map(s => s.name).join(', ') || '—';

                              const deltaClass = (delta: number, isOptimal: boolean) => {
                                if (delta >= 0 && !isOptimal) return 'text-success font-semibold';
                                if (delta >= 0 && isOptimal) {
                                  if (delta <= 10) return 'text-success font-semibold';
                                  return 'text-warning font-semibold';
                                }
                                if (delta < 0 && delta >= -5) return 'text-warning font-semibold';
                                return 'text-danger font-semibold';
                              };

                              return (
                                <tr key={w.id} className="border-b border-border/50 hover:bg-background-secondary transition-colors">
                                  <td className="py-2 px-3">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                                      <span className="font-semibold text-foreground">{w.name}</span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-foreground-muted">{skillNames}</td>
                                  <td className="py-2 px-3 text-center text-foreground">{minH}h</td>
                                  <td className="py-2 px-3 text-center text-foreground">{optH}h</td>
                                  <td className="py-2 px-3 text-center font-bold text-foreground">{w.actual_hours.toFixed(1)}h</td>
                                  <td className={`py-2 px-3 text-center ${deltaClass(deltaMin, false)}`}>
                                    {deltaMin >= 0 ? '+' : ''}{deltaMin.toFixed(1)}h
                                  </td>
                                  <td className={`py-2 px-3 text-center ${deltaClass(deltaOpt, true)}`}>
                                    {deltaOpt >= 0 ? '+' : ''}{deltaOpt.toFixed(1)}h
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="h-4 rounded" style={{ width: `${barWidth}%`, minWidth: 4, background: color }} />
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="border-t-2 border-border bg-background-secondary">
                              <td colSpan={2} className="py-2 px-3 font-bold text-foreground">TOTALS</td>
                              <td className="py-2 px-3 text-center font-bold text-foreground">{totalMin}h</td>
                              <td className="py-2 px-3 text-center font-bold text-foreground">{totalOptimal}h</td>
                              <td className="py-2 px-3 text-center font-bold text-foreground">{totalActual.toFixed(1)}h</td>
                              <td className="py-2 px-3 text-center font-bold text-foreground">
                                {(totalActual - totalMin) >= 0 ? '+' : ''}{(totalActual - totalMin).toFixed(1)}h
                              </td>
                              <td className="py-2 px-3 text-center font-bold text-foreground">
                                {(totalActual - totalOptimal) >= 0 ? '+' : ''}{(totalActual - totalOptimal).toFixed(1)}h
                              </td>
                              <td className="py-2 px-3" />
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {Object.keys(skillTotals).length > 0 && (
                        <p className="text-sm text-foreground-muted mt-3">
                          {Object.entries(skillTotals).map(([name, hours], i) => (
                            <span key={name}>
                              {i > 0 && ' · '}
                              {name} total: <strong>{hours.toFixed(1)}h</strong>
                            </span>
                          ))}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Solver diagnostics */}
                  {viewingSchedule?.solver_result?.diagnostics && viewingSchedule.solver_result.diagnostics.length > 0 && (
                    <Card>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-foreground mb-2">Solver Diagnostics</h3>
                        <ul className="text-sm text-foreground-muted space-y-1">
                          {viewingSchedule.solver_result.diagnostics.map((d, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-foreground-muted">→</span> {d}
                            </li>
                          ))}
                        </ul>

                        {viewingSchedule.solver_result.constraint_violations && viewingSchedule.solver_result.constraint_violations.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-semibold text-danger mb-2">
                              Constraint Violations ({viewingSchedule.solver_result.constraint_violations.length})
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm border-collapse">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="text-left py-1.5 px-3 text-xs font-semibold text-foreground-muted uppercase">Code</th>
                                    <th className="text-left py-1.5 px-3 text-xs font-semibold text-foreground-muted uppercase">Message</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {viewingSchedule.solver_result.constraint_violations.map((v, i) => (
                                    <tr key={i} className="border-b border-border/50 text-danger">
                                      <td className="py-1.5 px-3 font-mono text-xs">{v.code}</td>
                                      <td className="py-1.5 px-3">{v.message}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {activeGaps.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-semibold text-danger mb-2">
                              Coverage Gaps ({activeGaps.length})
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm border-collapse">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="text-left py-1.5 px-3 text-xs font-semibold text-foreground-muted uppercase">Day</th>
                                    <th className="text-left py-1.5 px-3 text-xs font-semibold text-foreground-muted uppercase">Time</th>
                                    <th className="text-left py-1.5 px-3 text-xs font-semibold text-foreground-muted uppercase">Position</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {activeGaps.map((gap, i) => {
                                    const gapDate = getDayDate(viewingSchedule.start_date, gap.day);
                                    return (
                                      <tr key={i} className="border-b border-border/50 text-danger">
                                        <td className="py-1.5 px-3">{gapDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                                        <td className="py-1.5 px-3">{formatMinutesToTime(gap.start_minutes)}–{formatMinutesToTime(gap.end_minutes)}</td>
                                        <td className="py-1.5 px-3">{getPositionName(gap.skill_id)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })()}

            {/* ===== LIST VIEW (detail view for this schedule) ===== */}
            {viewMode === 'list' && (() => {
              const result = viewingSchedule.solver_result;
              if (!result) return <p className="text-foreground-muted text-center py-8">No solver results for this schedule.</p>;
              return (
                <div className="space-y-4">
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
                      <h4 className="text-sm font-medium text-foreground mb-2">Hours by Team Member</h4>
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
                      <h4 className="text-sm font-medium text-foreground mb-2">Schedule by Day</h4>
                      <div className="space-y-3">
                        {Object.entries(getAssignmentsByDay(result.assignments, viewingSchedule.start_date))
                          .sort(([a], [b]) => Number(a) - Number(b))
                          .map(([dayStr, dayAssignments]) => {
                            const dayNum = Number(dayStr);
                            const dayDate = getDayDate(viewingSchedule.start_date, dayNum);
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
                                          <span>{formatMinutesToTime(assignment.start_minutes)} – {formatMinutesToTime(assignment.end_minutes)}</span>
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

                  {activeGaps.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-warning mb-2">Coverage Gaps ({activeGaps.length})</h4>
                      <div className="space-y-1.5">
                        {activeGaps.map((gap, idx) => {
                          const gapDate = getDayDate(viewingSchedule.start_date, gap.day);
                          return (
                            <div key={idx} className="flex items-center gap-3 p-2 bg-warning-muted/20 rounded text-sm">
                              <AlertCircle className="w-4 h-4 text-warning" />
                              <span className="text-foreground">
                                {gapDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: {formatMinutesToTime(gap.start_minutes)} – {formatMinutesToTime(gap.end_minutes)}
                              </span>
                              <Badge variant="warning" className="text-xs">{getPositionName(gap.skill_id)}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(!result.assignments || result.assignments.length === 0) && (
                    <div className="text-center py-4">
                      <p className="text-foreground-muted">No assignments were generated for this schedule.</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </PageContainer>
  );
}
