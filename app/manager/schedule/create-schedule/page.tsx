'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authedFetch } from '@/lib/api';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';

import { Calendar, Clock, MapPin, Users, Plus, Trash2, Save, Send, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';

interface ShiftTemplate {
  id: string;
  date: string;
  dayType: 'work' | 'off';
  shifts: Array<{
    id: string;
    startTime: string;
    endTime: string;
    position: string;
    workers: number;
  }>;
}

interface Place {
  id: string;
  name: string;
  address: string;
}

interface Position {
  id: string;
  name: string;
}

interface ScheduleFormData {
  id: string;
  name: string;
  place_id: string;
  start_date: string;
  end_date: string;
  availability_deadline: string;
  status: 'draft' | 'published' | 'closed' | 'schedule_published';
}

export default function CreateSchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const preselectedPlaceId = searchParams.get('place');

  const [places, setPlaces] = useState<Place[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<ScheduleFormData>({
    id: 'new',
    name: '',
    place_id: preselectedPlaceId || '',
    start_date: '',
    end_date: '',
    availability_deadline: '',
    status: 'draft',
  });
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [copySourceDay, setCopySourceDay] = useState<string | null>(null);
  const [selectedTargetDays, setSelectedTargetDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    await Promise.all([fetchPlaces(), fetchPositions()]);

    // If editing an existing draft, load it
    if (editId) {
      await loadExistingSchedule(editId);
    }

    setIsLoading(false);
  };

  const loadExistingSchedule = async (id: string) => {
    try {
      const response = await authedFetch('/api/manager/schedule-templates');

      if (response.ok) {
        const data = await response.json();
        const templates = data.templates || [];
        const target = templates.find((t: any) => t.id === id);
        if (target) {
          setFormData({
            id: target.id,
            name: target.name || '',
            place_id: target.place_id || '',
            start_date: target.start_date || '',
            end_date: target.end_date || '',
            availability_deadline: target.availability_deadline || '',
            status: target.status,
          });

          if (target.start_date && target.end_date) {
            const startDate = new Date(target.start_date);
            const endDate = new Date(target.end_date);
            setDateRange({ start: startDate, end: endDate });
            setCurrentMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));

            if (target.shifts && target.shifts.length > 0) {
              const transformedShifts = target.shifts.map((shift: any) => ({
                id: shift.id,
                date: shift.date,
                dayType: shift.day_type || shift.dayType || 'work',
                shifts: shift.shifts || [],
              }));
              setShiftTemplates(transformedShifts);
            } else {
              generateShiftTemplatesFromRange(startDate, endDate);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
  };

  const fetchPlaces = async () => {
    try {
      const response = await authedFetch('/api/manager/places');

      if (response.ok) {
        const data = await response.json();
        setPlaces(data.places || []);
      } else {
        setPlaces([]);
      }
    } catch (error) {
      console.error('Error fetching places:', error);
      setPlaces([]);
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await authedFetch('/api/manager/positions');

      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
      setPositions([]);
    }
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7; // 0=Mon..6=Sun
    const calendarStart = new Date(firstDay);
    calendarStart.setDate(calendarStart.getDate() - mondayOffset);

    const days: Array<{
      date: number; month: number; year: number;
      isCurrentMonth: boolean; isToday: boolean;
      isStart: boolean; isEnd: boolean; isInRange: boolean;
    }> = [];
    const today = new Date();

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(calendarStart);
      currentDate.setDate(calendarStart.getDate() + i);

      const isCurrentMonth = currentDate.getMonth() === month;
      const isToday = currentDate.toDateString() === today.toDateString();

      const isWithinTimeframe = dateRange.start && dateRange.end &&
        currentDate >= dateRange.start && currentDate <= dateRange.end;

      const isStart = !!(dateRange.start && currentDate.toDateString() === dateRange.start.toDateString());
      const isEnd = !!(dateRange.end && currentDate.toDateString() === dateRange.end.toDateString());
      const isInRange = !!isWithinTimeframe && !isStart && !isEnd;

      days.push({ date: currentDate.getDate(), month: currentDate.getMonth(), year: currentDate.getFullYear(), isCurrentMonth, isToday, isStart, isEnd, isInRange });
    }

    return days;
  };

  const generateShiftTemplatesFromRange = (startDate: Date, endDate: Date) => {
    const templates: ShiftTemplate[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

      const existingTemplate = shiftTemplates.find(t => t.date === dateStr);

      if (existingTemplate) {
        templates.push(existingTemplate);
      } else {
        templates.push({
          id: `day-${dateStr}`,
          date: dateStr,
          dayType: 'work',
          shifts: [],
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    setShiftTemplates(templates);
  };

  const handleDateChange = (field: 'start_date' | 'end_date', value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    const startStr = field === 'start_date' ? value : formData.start_date;
    const endStr = field === 'end_date' ? value : formData.end_date;

    if (startStr && endStr) {
      const startDate = new Date(startStr);
      const endDate = new Date(endStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDate < today) {
        alert('Start date cannot be in the past.');
        setFormData(prev => ({ ...prev, [field]: '' }));
        return;
      }
      if (endDate < startDate) {
        alert('End date must be after or equal to the start date.');
        setFormData(prev => ({ ...prev, [field]: '' }));
        return;
      }

      setDateRange({ start: startDate, end: endDate });
      setCurrentMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
      generateShiftTemplatesFromRange(startDate, endDate);
    } else {
      setDateRange({ start: null, end: null });
      setShiftTemplates([]);
    }
  };

  const addShift = (dayId: string) => {
    setShiftTemplates(prev => prev.map(template => {
      if (template.id === dayId && template.dayType === 'work') {
        const newShift = {
          id: `shift-${Date.now()}`,
          startTime: '10:00',
          endTime: '16:00',
          position: positions[0]?.id || '',
          workers: 1,
        };
        return { ...template, shifts: [...template.shifts, newShift] };
      }
      return template;
    }));
  };

  const removeShift = (dayId: string, shiftId: string) => {
    setShiftTemplates(prev => prev.map(template => {
      if (template.id === dayId) {
        return { ...template, shifts: template.shifts.filter(shift => shift.id !== shiftId) };
      }
      return template;
    }));
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

  const handleTimeChange = (dayId: string, shiftId: string, field: 'startTime' | 'endTime', inputValue: string, currentValue: string) => {
    const formatted = formatTimeInput(inputValue, currentValue);
    updateShift(dayId, shiftId, field, formatted);
  };

  const updateShift = (dayId: string, shiftId: string, field: string, value: any) => {
    setShiftTemplates(prev => prev.map(template => {
      if (template.id === dayId) {
        return {
          ...template,
          shifts: template.shifts.map(shift =>
            shift.id === shiftId ? { ...shift, [field]: value } : shift
          ),
        };
      }
      return template;
    }));
  };

  const toggleDayType = (dayId: string) => {
    setShiftTemplates(prev => prev.map(template => {
      if (template.id === dayId) {
        return {
          ...template,
          dayType: template.dayType === 'work' ? 'off' : 'work',
          shifts: template.dayType === 'work' ? [] : [{
            id: `shift-${Date.now()}`,
            startTime: '09:00',
            endTime: '17:00',
            position: positions[0]?.id || '',
            workers: 1,
          }],
        };
      }
      return template;
    }));
  };

  const validateTimeFormat = (timeString: string) => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    return timeRegex.test(timeString);
  };

  const validateShiftTime = (startTime: string, endTime: string) => {
    if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
      return { valid: false, error: 'Time format must be HH:MM (24-hour format)' };
    }
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    if (endMinutes <= startMinutes) {
      return { valid: false, error: 'End time must be after start time' };
    }
    return { valid: true, error: null };
  };

  const saveSchedule = async (andPublish: boolean = false) => {
    if (!dateRange.start || !dateRange.end) {
      alert('Please select a date range');
      return;
    }
    if (!formData.name?.trim()) {
      alert('Please enter a name for the schedule');
      return;
    }
    if (!formData.place_id) {
      alert('Please select a place');
      return;
    }

    // Validate all shift times
    for (const template of shiftTemplates) {
      if (template.dayType === 'work') {
        for (const shift of template.shifts) {
          const validation = validateShiftTime(shift.startTime, shift.endTime);
          if (!validation.valid) {
            alert(`Invalid shift time for ${formatDate(template.date)}: ${validation.error}`);
            return;
          }
        }
      }
    }

    setIsSaving(true);

    try {
      // Auto-set availability deadline for backwards compat
      const endDate = dateRange.end || new Date();
      const deadline = new Date(endDate);
      deadline.setDate(deadline.getDate() + 1);
      const availabilityDeadline = `${deadline.toISOString().split('T')[0]} 23:59`;

      const templateData = {
        name: formData.name.trim(),
        placeId: formData.place_id,
        startDate: dateRange.start.toISOString().split('T')[0],
        endDate: dateRange.end.toISOString().split('T')[0],
        availabilityDeadline: availabilityDeadline,
        status: 'draft',
        shifts: shiftTemplates.map(template => ({
          date: template.date,
          dayType: template.dayType,
          shifts: template.shifts,
        })),
      };

      const isNew = formData.id === 'new';

      let response;
      if (isNew) {
        response = await authedFetch('/api/manager/schedule-templates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(templateData),
        });
      } else {
        response = await authedFetch('/api/manager/schedule-templates', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: formData.id, ...templateData }),
        });
      }

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          if (andPublish) {
            // Publish and run solver
            const scheduleId = result.id || formData.id;
            await publishAndSolve(scheduleId);
          } else {
            router.push('/manager/schedule');
          }
        } else {
          alert(`Failed to ${isNew ? 'create' : 'update'} schedule`);
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || `Failed to ${isNew ? 'create' : 'update'} schedule`);
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('An error occurred while saving the schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const publishAndSolve = async (scheduleId: string) => {
    try {
      // Step 1: Mark as published
      const pubResponse = await authedFetch('/api/manager/schedule-templates/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: scheduleId }),
      });

      if (!pubResponse.ok) {
        const err = await pubResponse.json();
        alert(err.error || 'Failed to publish');
        router.push('/manager/schedule');
        return;
      }

      // Step 2: Trigger solver
      const solverResponse = await authedFetch('/api/manager/schedule-templates/process-deadline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ schedule_template_id: scheduleId }),
      });

      const solverResult = await solverResponse.json();

      if (solverResponse.ok && solverResult.success) {
        if (solverResult.is_feasible) {
          alert(`Schedule generated successfully! ${solverResult.result?.assignments?.length || 0} shifts assigned.\n\nReview the schedule and approve it to send to the team.`);
        } else {
          alert(`Schedule generated with coverage gaps. Review the results and edit manually if needed.`);
        }
        router.push(`/manager/schedule?review=${scheduleId}`);
      } else {
        alert(solverResult.error || 'Solver failed. You can retry from the schedule list.');
        router.push('/manager/schedule');
      }
    } catch (error) {
      console.error('Error publishing:', error);
      alert('An error occurred during publishing');
      router.push('/manager/schedule');
    }
  };

  const copyToAllDays = () => {
    const sourceTemplate = shiftTemplates.find(t => t.dayType === 'work' && t.shifts.length > 0);

    if (!sourceTemplate) {
      alert('Please create a work day with shifts first to copy from.');
      return;
    }

    const confirmCopy = confirm(`Copy shifts from ${formatDate(sourceTemplate.date)} to ALL work days? This will replace existing shifts on other work days.`);
    if (!confirmCopy) return;

    setShiftTemplates(prev => prev.map(template => {
      if (template.dayType === 'work' && template.id !== sourceTemplate.id) {
        return {
          ...template,
          shifts: sourceTemplate.shifts.map(shift => ({
            ...shift,
            id: `shift-${Date.now()}-${Math.random()}`,
          })),
        };
      }
      return template;
    }));
  };

  const startCopyMode = (dayId: string) => {
    const template = shiftTemplates.find(t => t.id === dayId);
    if (template && template.dayType === 'work' && template.shifts.length > 0) {
      setCopySourceDay(dayId);
      setSelectedTargetDays(new Set());
    }
  };

  const cancelCopyMode = () => {
    setCopySourceDay(null);
    setSelectedTargetDays(new Set());
  };

  const toggleTargetDay = (dayId: string) => {
    const template = shiftTemplates.find(t => t.id === dayId);
    if (template && template.dayType === 'work') {
      setSelectedTargetDays(prev => {
        const newSet = new Set(prev);
        if (newSet.has(dayId)) { newSet.delete(dayId); } else { newSet.add(dayId); }
        return newSet;
      });
    }
  };

  const applyCopiedShifts = () => {
    if (!copySourceDay || selectedTargetDays.size === 0) return;
    const sourceTemplate = shiftTemplates.find(t => t.id === copySourceDay);
    if (!sourceTemplate) return;

    setShiftTemplates(prev => prev.map(template => {
      if (selectedTargetDays.has(template.id)) {
        return {
          ...template,
          shifts: sourceTemplate.shifts.map(shift => ({
            ...shift,
            id: `shift-${Date.now()}-${Math.random()}`,
          })),
        };
      }
      return template;
    }));

    cancelCopyMode();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const navigateMonth = (direction: number) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const navigateToTimeframe = () => {
    if (!dateRange.start) return;
    setCurrentMonth(new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), 1));
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/manager/schedule')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">
              {editId ? 'Edit Schedule' : 'Create Schedule'}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/manager/schedule')}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => saveSchedule(false)} isLoading={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button onClick={() => saveSchedule(true)} isLoading={isSaving}>
              <Send className="w-4 h-4 mr-2" />
              Save & Publish
            </Button>
          </div>
        </div>

        {/* Schedule Info */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Schedule Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Schedule Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Summer Schedule 2025, Weekend Shifts"
                  className="w-full p-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Place <span className="text-danger">*</span>
                </label>
                <select
                  value={formData.place_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, place_id: e.target.value }))}
                  className="w-full p-2 border border-border rounded-lg bg-background text-foreground"
                >
                  <option value="">Select a place</option>
                  {places.length === 0 ? (
                    <option value="" disabled>No places available</option>
                  ) : (
                    places.map(place => (
                      <option key={place.id} value={place.id}>{place.name}</option>
                    ))
                  )}
                </select>
                {places.length === 0 && (
                  <p className="text-xs text-foreground-muted mt-1">
                    No places found. Please create places first.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Start Date <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => handleDateChange('start_date', e.target.value)}
                    className="w-full p-2 border border-border rounded-lg bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    End Date <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    min={formData.start_date || new Date().toISOString().split('T')[0]}
                    onChange={(e) => handleDateChange('end_date', e.target.value)}
                    className="w-full p-2 border border-border rounded-lg bg-background text-foreground"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Preview */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground mb-2">Selected Timeframe</h3>
              <p className="text-sm text-foreground-muted">
                The calendar shows your selected date range. Use the shift templates below to configure work days and shifts.
              </p>
              {dateRange.start && dateRange.end && (
                <div className="mt-2 p-2 bg-background-secondary rounded-lg">
                  <span className="text-sm font-medium text-foreground">
                    Timeframe: {dateRange.start.toLocaleDateString()} – {dateRange.end.toLocaleDateString()}
                    <span className="text-foreground-muted ml-2">
                      ({Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Calendar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-4">
                <Button variant="outline" size="sm" onClick={() => navigateMonth(-1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-foreground">
                    {getMonthName(currentMonth)}
                  </h3>
                  {dateRange.start && dateRange.end && (
                    <Button variant="ghost" size="sm" onClick={navigateToTimeframe} className="mt-1 text-xs">
                      Go to Start
                    </Button>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => navigateMonth(1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-xs">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="text-center font-medium text-foreground-muted p-1">
                    {day}
                  </div>
                ))}
                {generateCalendarDays().map((day, index) => {
                  const isWithinTimeframe = dateRange.start && dateRange.end &&
                    new Date(day.year, day.month, day.date) >= dateRange.start &&
                    new Date(day.year, day.month, day.date) <= dateRange.end;

                  const dateStr = `${day.year}-${String(day.month + 1).padStart(2, '0')}-${String(day.date).padStart(2, '0')}`;
                  const template = shiftTemplates.find(t => t.date === dateStr);
                  const isDayOff = template?.dayType === 'off';

                  let cellClass = '';
                  if (day.isStart || day.isEnd) {
                    cellClass = isDayOff ? 'bg-warning text-white' : 'bg-success text-white';
                  } else if (isWithinTimeframe) {
                    cellClass = isDayOff ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success';
                  } else if (!day.isCurrentMonth) {
                    cellClass = 'text-foreground-muted/40';
                  } else {
                    cellClass = 'opacity-30 cursor-not-allowed';
                  }

                  if (day.isToday && isWithinTimeframe && !day.isStart && !day.isEnd) {
                    cellClass = isDayOff ? 'bg-warning text-white' : 'bg-success text-white';
                  }

                  return (
                    <div
                      key={index}
                      className={`relative p-1 text-center rounded transition-colors text-xs ${cellClass}`}
                    >
                      {day.date}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shift Templates */}
        {shiftTemplates.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Shift Templates</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyToAllDays} className="text-xs">
                  Copy to All
                </Button>
                {copySourceDay && (
                  <div className="text-sm text-accent">
                    <strong>Copy Mode:</strong> Click work days to select targets, then click &quot;Apply&quot;
                  </div>
                )}
              </div>
            </div>

            {positions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Positions Available</h3>
                  <p className="text-foreground-muted mb-4">
                    Please add positions to your company before creating shift templates
                  </p>
                </CardContent>
              </Card>
            ) : (
              shiftTemplates.map((template) => (
                <Card
                  key={template.id}
                  className={`
                    ${copySourceDay && template.dayType === 'work' && template.id !== copySourceDay ? 'cursor-pointer hover:bg-background-secondary' : ''}
                    ${selectedTargetDays.has(template.id) ? 'ring-2 ring-warning' : ''}
                  `}
                  onClick={() => copySourceDay && template.dayType === 'work' && template.id !== copySourceDay && toggleTargetDay(template.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Calendar className="w-4 h-4 text-foreground-muted shrink-0" />
                        <span className="font-medium text-sm">{formatDate(template.date)}</span>
                        <Badge variant={template.dayType === 'work' ? 'success' : 'warning'} className="text-xs">
                          {template.dayType === 'work' ? 'Work' : 'Off'}
                        </Badge>
                        {copySourceDay === template.id && (
                          <Badge variant="info" className="text-xs">Source</Badge>
                        )}
                        {selectedTargetDays.has(template.id) && (
                          <Badge variant="warning" className="text-xs">Target</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {copySourceDay === template.id ? (
                        <>
                          <Button size="sm" variant="outline" onClick={cancelCopyMode} className="text-xs px-2 py-1 h-8">
                            Cancel
                          </Button>
                          {selectedTargetDays.size > 0 && (
                            <Button size="sm" onClick={applyCopiedShifts} className="text-xs px-2 py-1 h-8">
                              Apply ({selectedTargetDays.size})
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => toggleDayType(template.id)} className="text-xs px-2 py-1 h-8">
                            {template.dayType === 'work' ? 'Off' : 'Work'}
                          </Button>
                          {template.dayType === 'work' && (
                            <>
                              {template.shifts.length > 0 && (
                                <Button size="sm" variant="outline" onClick={() => startCopyMode(template.id)} className="text-xs px-2 py-1 h-8">
                                  Copy
                                </Button>
                              )}
                              <Button size="sm" variant="outline" onClick={() => addShift(template.id)} className="text-xs px-2 py-1 h-8">
                                <Plus className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {template.dayType === 'work' && template.shifts.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {template.shifts.map((shift) => (
                          <div key={shift.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-background-secondary rounded-lg">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-foreground-muted" />
                              <input
                                type="text"
                                inputMode="numeric"
                                value={shift.startTime}
                                onChange={(e) => handleTimeChange(template.id, shift.id, 'startTime', e.target.value, shift.startTime)}
                                placeholder="09:00"
                                maxLength={5}
                                className="w-20 px-2 py-1 border border-border rounded text-sm text-center font-mono bg-background text-foreground"
                              />
                              <span className="text-foreground-muted text-sm">to</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={shift.endTime}
                                onChange={(e) => handleTimeChange(template.id, shift.id, 'endTime', e.target.value, shift.endTime)}
                                placeholder="17:00"
                                maxLength={5}
                                className="w-20 px-2 py-1 border border-border rounded text-sm text-center font-mono bg-background text-foreground"
                              />
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <select
                                value={shift.position}
                                onChange={(e) => updateShift(template.id, shift.id, 'position', e.target.value)}
                                className="px-2 py-1 border border-border rounded text-sm bg-background text-foreground"
                              >
                                {positions.map(position => (
                                  <option key={position.id} value={position.id}>{position.name}</option>
                                ))}
                              </select>
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-foreground-muted" />
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={shift.workers}
                                  onChange={(e) => updateShift(template.id, shift.id, 'workers', parseInt(e.target.value))}
                                  className="w-16 px-2 py-1 border border-border rounded text-sm bg-background text-foreground"
                                />
                                <span className="text-foreground-muted text-sm">workers</span>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => removeShift(template.id, shift.id)} className="text-xs px-2 py-1 h-8">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {template.dayType === 'work' && template.shifts.length === 0 && (
                      <div className="text-center py-4 text-foreground-muted">
                        No shifts scheduled for this day
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Bottom action bar */}
        {shiftTemplates.length > 0 && (
          <div className="sticky bottom-0 bg-background border-t border-border p-4 -mx-4 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => router.push('/manager/schedule')}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => saveSchedule(false)} isLoading={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button onClick={() => saveSchedule(true)} isLoading={isSaving}>
              <Send className="w-4 h-4 mr-2" />
              Save & Publish
            </Button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
