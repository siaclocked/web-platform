'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { BackButton } from '@/components/ui';
import { Calendar, Clock, MapPin, Users, Plus, Trash2, Save, Send, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Edit, Trash } from 'lucide-react';

interface ShiftTemplate {
  id: string;
  date: string;
  dayType: 'work' | 'off';
  shifts: Array<{
    id: string;
    startTime: string;
    endTime: string;
    position: string;
    workers: number; // Changed from minWorkers/maxWorkers to single workers
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

interface Timesheet {
  id: string;
  name: string;
  place_id: string;
  start_date: string;
  end_date: string;
  availability_deadline: string;
  status: 'draft' | 'published' | 'closed';
  company_id: string;
  manager_id: string;
  created_at: string;
  updated_at?: string;
  shifts?: ShiftTemplate[];
}

interface CalendarDay {
  date: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isInRange: boolean;
  isStart: boolean;
  isEnd: boolean;
}

export default function ManagerTimesheetsPage() {
  const router = useRouter();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingTimesheet, setEditingTimesheet] = useState<Timesheet | null>(null);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [copySourceDay, setCopySourceDay] = useState<string | null>(null);
  const [selectedTargetDays, setSelectedTargetDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTimesheets();
    fetchPlaces();
    fetchPositions();
  }, []);

  const fetchTimesheets = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/manager/schedule-templates', {
        headers: {
          'Authorization': `Bearer ${session.access_token || ''}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setTimesheets(data.templates || []);
      } else {
        console.error('Failed to fetch schedule templates');
        setTimesheets([]);
      }
    } catch (error) {
      console.error('Error fetching timesheets:', error);
      setTimesheets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlaces = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('No session found for fetchPlaces');
        setPlaces([]);
        return;
      }

      const response = await fetch('/api/manager/places', {
        headers: {
          'Authorization': `Bearer ${session.access_token || ''}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Places fetched:', data.places);
        setPlaces(data.places || []);
      } else {
        console.error('Failed to fetch places');
        setPlaces([]);
      }
    } catch (error) {
      console.error('Error fetching places:', error);
      setPlaces([]);
    }
  };

  const fetchPositions = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
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
      setPositions([]);
    }
  };

  const generateCalendarDays = (): CalendarDay[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const calendarStart = new Date(firstDay);
    calendarStart.setDate(calendarStart.getDate() - firstDay.getDay());
    
    const days: CalendarDay[] = [];
    const today = new Date();
    
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(calendarStart);
      currentDate.setDate(calendarStart.getDate() + i);
      
      const isCurrentMonth = currentDate.getMonth() === month;
      const isToday = currentDate.toDateString() === today.toDateString();
      
      // Check if date is within the selected timeframe
      const isWithinTimeframe = dateRange.start && dateRange.end && 
        currentDate >= dateRange.start && currentDate <= dateRange.end;
      
      // Only allow selection if within timeframe and current month
      const isSelectable = isCurrentMonth && isWithinTimeframe;
      
      // Visual states
      const isSelected = isWithinTimeframe;
      const isStart = dateRange.start && currentDate.toDateString() === dateRange.start.toDateString();
      const isEnd = dateRange.end && currentDate.toDateString() === dateRange.end.toDateString();
      const isInRange = isWithinTimeframe && !isStart && !isEnd;
      
      days.push({
        date: currentDate.getDate(),
        month: currentDate.getMonth(),
        year: currentDate.getFullYear(),
        isCurrentMonth,
        isToday,
        isSelected: isSelected || false,
        isInRange: isInRange || false,
        isStart: isStart || false,
        isEnd: isEnd || false
      });
    }
    
    return days;
  };

  const handleDateClick = (day: CalendarDay) => {
    if (!day.isCurrentMonth) return;
    
    const clickedDate = new Date(day.year, day.month, day.date);
    
    // Check if date is within the selected timeframe
    const isWithinTimeframe = dateRange.start && dateRange.end && 
      clickedDate >= dateRange.start && clickedDate <= dateRange.end;
    
    if (!isWithinTimeframe) return; // Don't allow selection outside timeframe
    
    // For shift editing, we don't need date range selection anymore
    // Just use the double-click for work/off toggling
  };

  const handleDateDoubleClick = (day: CalendarDay) => {
    // Remove double-click functionality - calendar is visual only
    return;
  };

  const startNewTimesheet = () => {
    const newTimesheet: Timesheet = {
      id: 'new',
      name: '',
      place_id: '',
      start_date: '',
      end_date: '',
      availability_deadline: '',
      status: 'draft',
      company_id: '',
      manager_id: '',
      created_at: new Date().toISOString()
    };

    setEditingTimesheet(newTimesheet);
    setShiftTemplates([]);
    setDateRange({ start: null, end: null });
    setCreatingNew(true);
  };

  const handleDateRangeChange = () => {
    if (!editingTimesheet?.start_date || !editingTimesheet?.end_date) {
      setDateRange({ start: null, end: null });
      setShiftTemplates([]);
      return;
    }

    const startDate = new Date(editingTimesheet.start_date);
    const endDate = new Date(editingTimesheet.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today for fair comparison
    
    // Validate that start date is not in the past
    if (startDate < today) {
      alert('Start date cannot be in the past. Please select a date that is today or in the future.');
      // Clear the invalid start date
      setEditingTimesheet(prev => prev ? {...prev, start_date: ''} : null);
      setDateRange({ start: null, end: null });
      setShiftTemplates([]);
      return;
    }
    
    // Validate that end date is after or equal to start date
    if (endDate < startDate) {
      alert('End date must be after or equal to the start date.');
      // Clear the invalid end date
      setEditingTimesheet(prev => prev ? {...prev, end_date: ''} : null);
      setDateRange({ start: null, end: null });
      setShiftTemplates([]);
      return;
    }
    
    setDateRange({ start: startDate, end: endDate });
    setCurrentMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
    generateShiftTemplatesFromRange(startDate, endDate);
  };

const generateShiftTemplatesFromRange = (startDate: Date, endDate: Date) => {
    const templates: ShiftTemplate[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      // Create date string in local timezone to avoid UTC issues
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      
      // Check if we already have a template for this date
      const existingTemplate = shiftTemplates.find(t => t.date === dateStr);
      
      if (existingTemplate) {
        templates.push(existingTemplate);
      } else {
        // Default to work day (let manager decide which days are off)
        templates.push({
          id: `day-${dateStr}`,
          date: dateStr,
          dayType: 'work',
          shifts: []
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    setShiftTemplates(templates);
  };

  const addShift = (dayId: string) => {
    setShiftTemplates(prev => prev.map(template => {
      if (template.id === dayId && template.dayType === 'work') {
        const newShift = {
          id: `shift-${Date.now()}`,
          startTime: '10:00',
          endTime: '16:00',
          position: positions[0]?.id || '',
          workers: 1
        };
        return {
          ...template,
          shifts: [...template.shifts, newShift]
        };
      }
      return template;
    }));
  };

  const removeShift = (dayId: string, shiftId: string) => {
    setShiftTemplates(prev => prev.map(template => {
      if (template.id === dayId) {
        return {
          ...template,
          shifts: template.shifts.filter(shift => shift.id !== shiftId)
        };
      }
      return template;
    }));
  };

  const updateShift = (dayId: string, shiftId: string, field: string, value: any) => {
    setShiftTemplates(prev => prev.map(template => {
      if (template.id === dayId) {
        return {
          ...template,
          shifts: template.shifts.map(shift => 
            shift.id === shiftId ? { ...shift, [field]: value } : shift
          )
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
          shifts: template.dayType === 'work' ? [] : [
            {
              id: `shift-${Date.now()}`,
              startTime: '09:00',
              endTime: '17:00',
              position: positions[0]?.id || '',
              workers: 1
            }
          ]
        };
      }
      return template;
    }));
  };

  const saveTimesheet = async () => {
    if (!editingTimesheet) return;

    if (!dateRange.start || !dateRange.end) {
      alert('Please select a date range using the calendar');
      return;
    }

    if (!editingTimesheet.name?.trim()) {
      alert('Please enter a name for the schedule template');
      return;
    }

    if (!editingTimesheet.place_id) {
      alert('Please select a place for the schedule template');
      return;
    }

    if (!editingTimesheet.availability_deadline) {
      alert('Please set an availability deadline for the schedule template');
      return;
    }

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('You must be logged in to save schedule templates');
        return;
      }

      // Prepare the schedule template data
      const templateData = {
        name: editingTimesheet.name.trim(),
        placeId: editingTimesheet.place_id,
        startDate: dateRange.start.toISOString().split('T')[0],
        endDate: dateRange.end.toISOString().split('T')[0],
        availabilityDeadline: editingTimesheet.availability_deadline,
        status: 'draft',
        shifts: shiftTemplates.map(template => ({
          date: template.date,
          dayType: template.dayType,
          shifts: template.shifts
        }))
      };

      let response;
      const isNew = editingTimesheet.id === 'new';

      if (isNew) {
        // Create new schedule template
        response = await fetch('/api/manager/schedule-templates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token || ''}`,
          },
          body: JSON.stringify(templateData),
        });
      } else {
        // Update existing schedule template
        response = await fetch('/api/manager/schedule-templates', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token || ''}`,
          },
          body: JSON.stringify({
            id: editingTimesheet.id,
            ...templateData
          }),
        });
      }

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          // Refresh the timesheets list
          await fetchTimesheets();
          
          // Close the editor
          setCreatingNew(false);
          setEditingTimesheet(null);
          setShiftTemplates([]);
          setDateRange({ start: null, end: null });
          
          alert(`Schedule template "${templateData.name}" ${isNew ? 'created' : 'updated'} successfully!`);
        } else {
          alert(`Failed to ${isNew ? 'create' : 'update'} schedule template`);
        }
      } else {
        const errorData = await response.json();
        console.error('Save error:', errorData);
        alert(errorData.error || `Failed to ${isNew ? 'create' : 'update'} schedule template`);
      }
    } catch (error) {
      console.error('Error saving timesheet:', error);
      alert('An error occurred while saving the schedule template');
    }
  };

  const deleteTimesheet = async (timesheetId: string, timesheetName: string) => {
    if (!confirm(`Are you sure you want to delete "${timesheetName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('You must be logged in to delete schedule templates');
        return;
      }

      const response = await fetch('/api/manager/schedule-templates', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token || ''}`,
        },
        body: JSON.stringify({ id: timesheetId }),
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          // Refresh the timesheets list
          await fetchTimesheets();
          
          alert(`Schedule template "${timesheetName}" deleted successfully!`);
        } else {
          alert('Failed to delete schedule template');
        }
      } else {
        const errorData = await response.json();
        console.error('Delete error:', errorData);
        alert(errorData.error || 'Failed to delete schedule template');
      }
    } catch (error) {
      console.error('Error deleting timesheet:', error);
      alert('An error occurred while deleting the schedule template');
    }
  };

  const publishTimesheet = async (timesheetId: string) => {
    try {
      // Mock publish - replace with actual API call
      setTimesheets(prev => prev.map(t => 
        t.id === timesheetId ? { ...t, status: 'published' as const } : t
      ));
    } catch (error) {
      console.error('Error publishing timesheet:', error);
    }
  };

  const cancelCopyMode = () => {
    setCopySourceDay(null);
    setSelectedTargetDays(new Set());
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
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
    
    // Navigate to the month of the start date
    setCurrentMonth(new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), 1));
  };

  const startCopyMode = (dayId: string) => {
    const template = shiftTemplates.find(t => t.id === dayId);
    if (template && template.dayType === 'work' && template.shifts.length > 0) {
      setCopySourceDay(dayId);
      setSelectedTargetDays(new Set());
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'success';
      case 'closed': return 'danger';
      case 'draft': return 'warning';
      default: return 'default';
    }
  };

  const formatTimeForInput = (timeString: string) => {
    // Convert 24-hour format to HH:MM format for display
    if (!timeString) return '';
    return timeString.slice(0, 5); // Assumes format is "HH:MM:SS" or "HH:MM"
  };

  const parseTimeInput = (timeString: string) => {
    // Validate and format time input to HH:MM format
    if (!timeString) return '';
    
    // Remove any non-digit characters except colon
    const cleanTime = timeString.replace(/[^\d:]/g, '');
    
    // Parse hours and minutes
    const parts = cleanTime.split(':');
    let hours = parseInt(parts[0]) || 0;
    let minutesVal = parseInt(parts[1]) || 0;
    
    // Validate hours (0-23) and minutes (0-59)
    if (hours > 23) hours = 23;
    if (minutesVal > 59) minutesVal = 59;
    
    return `${hours.toString().padStart(2, '0')}:${minutesVal.toString().padStart(2, '0')}`;
  };

  const toggleTargetDay = (dayId: string) => {
    const template = shiftTemplates.find(t => t.id === dayId);
    if (template && template.dayType === 'work') {
      setSelectedTargetDays(prev => {
        const newSet = new Set(prev);
        if (newSet.has(dayId)) {
          newSet.delete(dayId);
        } else {
          newSet.add(dayId);
        }
        return newSet;
      });
    }
  };

  const copyToAllDays = () => {
    // Find the first work day with shifts
    const sourceTemplate = shiftTemplates.find(t => t.dayType === 'work' && t.shifts.length > 0);
    
    if (!sourceTemplate) {
      alert('Please create a work day with shifts first to copy from.');
      return;
    }

    const confirmCopy = confirm(`Copy shifts from ${formatDate(sourceTemplate.date)} to ALL work days in this timeframe? This will replace any existing shifts on other work days.`);
    if (!confirmCopy) return;

    // Apply to all work days
    setShiftTemplates(prev => prev.map(template => {
      if (template.dayType === 'work' && template.id !== sourceTemplate.id) {
        return {
          ...template,
          shifts: sourceTemplate.shifts.map(shift => ({
            ...shift,
            id: `shift-${Date.now()}-${Math.random()}` // Unique ID for each copied shift
          }))
        };
      }
      return template;
    }));

    alert(`Shifts copied to all work days!`);
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
            id: `shift-${Date.now()}-${Math.random()}` // Unique ID for each copied shift
          }))
        };
      }
      return template;
    }));

    cancelCopyMode();
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

  if (creatingNew || editingTimesheet) {
    return (
      <PageContainer>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <BackButton href="/manager/timesheets" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setCreatingNew(false); setEditingTimesheet(null); setDateRange({ start: null, end: null }); }}>
                Cancel
              </Button>
              <Button onClick={saveTimesheet}>
                <Save className="w-4 h-4 mr-2" />
                Save Draft
              </Button>
            </div>
          </div>

          {/* Timesheet Info */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {editingTimesheet?.id === 'new' ? 'New Schedule Template' : 'Edit Schedule Template'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={editingTimesheet?.name || ''}
                    onChange={(e) => setEditingTimesheet(prev => prev ? {...prev, name: e.target.value} : null)}
                    placeholder="e.g., Summer Schedule 2025, Weekend Shifts"
                    className="w-full p-2 border border-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Place *
                  </label>
                  <select
                    value={editingTimesheet?.place_id || ''}
                    onChange={(e) => setEditingTimesheet(prev => prev ? {...prev, place_id: e.target.value} : null)}
                    className="w-full p-2 border border-border rounded-lg"
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
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={editingTimesheet?.start_date || ''}
                      min={new Date().toISOString().split('T')[0]} // Prevent selecting past dates
                      onChange={(e) => {
                        const newStartDate = e.target.value;
                        const newEndDate = editingTimesheet?.end_date || '';
                        
                        setEditingTimesheet(prev => prev ? {...prev, start_date: newStartDate} : null);
                        
                        // Check if we have both dates after this update
                        if (newStartDate && newEndDate) {
                          const startDate = new Date(newStartDate);
                          const endDate = new Date(newEndDate);
                          
                          setDateRange({ start: startDate, end: endDate });
                          setCurrentMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
                          generateShiftTemplatesFromRange(startDate, endDate);
                        } else if (newStartDate && !newEndDate) {
                          // Only start date selected, clear range
                          setDateRange({ start: null, end: null });
                          setShiftTemplates([]);
                        }
                      }}
                      className="w-full p-2 border border-border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={editingTimesheet?.end_date || ''}
                      min={editingTimesheet?.start_date || new Date().toISOString().split('T')[0]} // Prevent selecting before start date
                      onChange={(e) => {
                        const newEndDate = e.target.value;
                        const newStartDate = editingTimesheet?.start_date || '';
                        
                        setEditingTimesheet(prev => prev ? {...prev, end_date: newEndDate} : null);
                        
                        // Check if we have both dates after this update
                        if (newStartDate && newEndDate) {
                          const startDate = new Date(newStartDate);
                          const endDate = new Date(newEndDate);
                          
                          setDateRange({ start: startDate, end: endDate });
                          setCurrentMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
                          generateShiftTemplatesFromRange(startDate, endDate);
                        } else if (!newStartDate && newEndDate) {
                          // Only end date selected, clear range
                          setDateRange({ start: null, end: null });
                          setShiftTemplates([]);
                        }
                      }}
                      className="w-full p-2 border border-border rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Availability Deadline *
                  </label>
                  <input
                    type="datetime-local"
                    value={editingTimesheet?.availability_deadline || ''}
                    onChange={(e) => setEditingTimesheet(prev => prev ? {...prev, availability_deadline: e.target.value} : null)}
                    min={new Date().toISOString().slice(0, 16)} // Prevent selecting past dates
                    className="w-full p-2 border border-border rounded-lg"
                  />
                  <p className="text-xs text-foreground-muted mt-1">
                    Workers must set their availability before this deadline (24-hour format)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Date Range Selection */}
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
                      Timeframe: {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
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
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={navigateToTimeframe}
                        className="mt-1 text-xs"
                      >
                        Go to Start
                      </Button>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigateMonth(1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-7 gap-1 text-xs">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-medium text-foreground-muted p-1">
                      {day}
                    </div>
                  ))}
                  {generateCalendarDays().map((day, index) => {
                  const clickedDate = new Date(day.year, day.month, day.date);
                  const isWithinTimeframe = dateRange.start && dateRange.end && 
                    clickedDate >= dateRange.start && clickedDate <= dateRange.end;
                  

                  return (
                    <div
                      key={index}
                      className={`relative p-1 text-center cursor-pointer rounded transition-colors text-xs
                        ${!day.isCurrentMonth ? 'text-foreground-muted' : ''}
                        ${day.isStart ? (() => {
                          const dateStr = `${day.year}-${String(day.month + 1).padStart(2, '0')}-${String(day.date).padStart(2, '0')}`;
                          const template = shiftTemplates.find(t => t.date === dateStr);
                          if (template && template.dayType === 'off') {
                            return 'bg-warning text-white cursor-pointer hover:bg-warning/90';
                          }
                          return 'bg-success text-white cursor-pointer hover:bg-success/90';
                        })() : ''}
                        ${day.isEnd ? (() => {
                          const dateStr = `${day.year}-${String(day.month + 1).padStart(2, '0')}-${String(day.date).padStart(2, '0')}`;
                          const template = shiftTemplates.find(t => t.date === dateStr);
                          if (template && template.dayType === 'off') {
                            return 'bg-warning text-white cursor-pointer hover:bg-warning/90';
                          }
                          return 'bg-success text-white cursor-pointer hover:bg-success/90';
                        })() : ''}
                        ${!day.isStart && !day.isEnd ? (() => {
                          const dateStr = `${day.year}-${String(day.month + 1).padStart(2, '0')}-${String(day.date).padStart(2, '0')}`;
                          const template = shiftTemplates.find(t => t.date === dateStr);
                          if (template) {
                            return template.dayType === 'work' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning';
                          }
                          return isWithinTimeframe ? 'bg-success/20 text-success' : '';
                        })() : ''}
                        ${day.isToday && isWithinTimeframe && !day.isStart && !day.isEnd ? (() => {
                          const dateStr = `${day.year}-${String(day.month + 1).padStart(2, '0')}-${String(day.date).padStart(2, '0')}`;
                          const template = shiftTemplates.find(t => t.date === dateStr);
                          if (template) {
                            return template.dayType === 'work' ? 'bg-success text-white' : 'bg-warning text-white';
                          }
                          return 'bg-primary text-white';
                        })() : ''}
                        ${!day.isStart && !day.isEnd && isWithinTimeframe ? 'cursor-pointer hover:bg-background-secondary' : 'cursor-not-allowed opacity-30'}
                      `}
                      onClick={() => handleDateClick(day)}
                    >
                      {day.date}
                    </div>
                  );
                })}
                </div>
              </div>

              {/* Selected Range Display */}
              {dateRange.start && dateRange.end && (
                <div className="flex items-center gap-2 p-3 bg-background-secondary rounded-lg">
                  <Calendar className="w-4 h-4 text-foreground-muted" />
                  <span className="text-sm text-foreground">
                    Selected: {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    ({Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))} days)
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shift Templates */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Shift Templates</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyToAllDays}
                  className="text-xs"
                >
                  Copy to All
                </Button>
                {copySourceDay && (
                  <div className="text-sm text-info">
                    <strong>Copy Mode:</strong> Click work days to select as targets, then click "Apply" to copy shifts
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
                  <p className="text-sm text-foreground-muted">
                    Positions define the different roles workers can have (e.g., Waiter, Cook, Bartender)
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelCopyMode}
                            className="text-xs px-2 py-1 h-8"
                          >
                            Cancel
                          </Button>
                          {selectedTargetDays.size > 0 && (
                            <Button
                              size="sm"
                              onClick={applyCopiedShifts}
                              className="text-xs px-2 py-1 h-8"
                            >
                              Apply ({selectedTargetDays.size})
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleDayType(template.id)}
                            className="text-xs px-2 py-1 h-8"
                          >
                            {template.dayType === 'work' ? 'Off' : 'Work'}
                          </Button>
                          {template.dayType === 'work' && (
                            <>
                              {template.shifts.length > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startCopyMode(template.id)}
                                  className="text-xs px-2 py-1 h-8"
                                >
                                  Copy
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addShift(template.id)}
                                className="text-xs px-2 py-1 h-8"
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {template.dayType === 'work' && template.shifts.length > 0 && (
                      <div className="space-y-2">
                        {template.shifts.map((shift) => (
                          <div key={shift.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-background-secondary rounded-lg">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-foreground-muted" />
                              <input
                                type="text"
                                value={formatTimeForInput(shift.startTime)}
                                onChange={(e) => updateShift(template.id, shift.id, 'startTime', parseTimeInput(e.target.value))}
                                placeholder="09:00"
                                className="w-20 px-2 py-1 border border-border rounded text-sm"
                              />
                              <span className="text-foreground-muted text-sm">to</span>
                              <input
                                type="text"
                                value={formatTimeForInput(shift.endTime)}
                                onChange={(e) => updateShift(template.id, shift.id, 'endTime', parseTimeInput(e.target.value))}
                                placeholder="17:00"
                                className="w-20 px-2 py-1 border border-border rounded text-sm"
                              />
                              <span className="text-xs text-foreground-muted">24h</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <select
                                value={shift.position}
                                onChange={(e) => updateShift(template.id, shift.id, 'position', e.target.value)}
                                className="px-2 py-1 border border-border rounded text-sm"
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
                                  className="w-16 px-2 py-1 border border-border rounded text-sm"
                                />
                                <span className="text-foreground-muted text-sm">workers</span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removeShift(template.id, shift.id)}
                                className="text-xs px-2 py-1 h-8"
                              >
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
              <h1 className="text-2xl font-bold text-foreground">Schedule Templates</h1>
              <p className="text-foreground-muted">
                Create and manage shift templates for scheduling
              </p>
            </div>
            <Button onClick={startNewTimesheet}>
              <Plus className="w-4 h-4 mr-2" />
              Create Timesheet
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold text-foreground">
                {timesheets.filter(t => t.status === 'draft').length}
              </div>
              <p className="text-sm text-muted-foreground">Drafts</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
              <div className="text-2xl font-bold text-foreground">
                {timesheets.filter(t => t.status === 'published').length}
              </div>
              <p className="text-sm text-muted-foreground">Published</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-warning" />
              <div className="text-2xl font-bold text-foreground">
                {timesheets.length}
              </div>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Timesheets List */}
        {timesheets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Schedule Templates</h3>
              <p className="text-foreground-muted mb-4">
                Create your first schedule template to get started with shift planning
              </p>
              <Button onClick={startNewTimesheet}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Schedule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {timesheets.map((timesheet) => (
              <Card key={timesheet.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-foreground">
                        {timesheet.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="w-4 h-4 text-foreground-muted" />
                        <span className="text-sm text-muted-foreground">
                          {places.find(p => p.id === timesheet.place_id)?.name || 'Unknown Place'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDate(timesheet.start_date)} - {formatDate(timesheet.end_date)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-4 h-4 text-foreground-muted" />
                        <span className="text-sm text-muted-foreground">
                          Deadline: {new Date(timesheet.availability_deadline).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusColor(timesheet.status)}>
                        {timesheet.status}
                      </Badge>
                      {timesheet.status === 'draft' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => publishTimesheet(timesheet.id)}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Publish
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const template = {
                          ...timesheet,
                          start_date: timesheet.start_date,
                          end_date: timesheet.end_date,
                          place_id: timesheet.place_id,
                          availability_deadline: timesheet.availability_deadline
                        };
                        setEditingTimesheet(template);
                        setCreatingNew(false);
                        
                        // Load shift templates if they exist
                        if (timesheet.shifts) {
                          setShiftTemplates(timesheet.shifts);
                        } else {
                          setShiftTemplates([]);
                        }
                        
                        // Set date range
                        const startDate = new Date(timesheet.start_date);
                        const endDate = new Date(timesheet.end_date);
                        setDateRange({ start: startDate, end: endDate });
                        setCurrentMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
                        generateShiftTemplatesFromRange(startDate, endDate);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => publishTimesheet(timesheet.id)}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Publish
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => deleteTimesheet(timesheet.id, timesheet.name)}
                    >
                      <Trash className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
