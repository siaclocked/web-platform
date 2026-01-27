'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { BackButton } from '@/components/ui';
import { Calendar, Clock, MapPin, Check, AlertCircle, Users, ChevronDown, ChevronUp } from 'lucide-react';

interface ShiftData {
  id: string;
  startTime: string;
  endTime: string;
  position: string;
  workers: number;
}

interface ShiftTemplate {
  id: string;
  date: string;
  day_type: 'work' | 'off';
  shifts: ShiftData[];
}

interface Place {
  id: string;
  name: string;
  address?: string;
}

interface Timesheet {
  id: string;
  name: string;
  place_id: string;
  start_date: string;
  end_date: string;
  availability_deadline: string;
  status: string;
  places: Place;
  shift_templates: ShiftTemplate[];
  worker_skill_ids: string[];
  existing_submissions: Record<string, boolean>;
}

interface WorkerSkill {
  id: string;
  name: string;
}

interface SelectedShift {
  schedule_template_id: string;
  shift_template_id: string;
  shift_index: number;
  is_available: boolean;
}

export default function SetAvailabilityPage() {
  const router = useRouter();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [workerSkills, setWorkerSkills] = useState<WorkerSkill[]>([]);
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedShifts, setSelectedShifts] = useState<Record<string, boolean>>({});
  const [expandedTimesheets, setExpandedTimesheets] = useState<Set<string>>(new Set());
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [noPlacesMessage, setNoPlacesMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchTimesheets();
    fetchPositions();
  }, []);

  const fetchTimesheets = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/worker/timesheets', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTimesheets(data.timesheets || []);
        setWorkerSkills(data.worker_skills || []);
        
        // Check if there's a message about no places assigned
        if (data.message && data.timesheets?.length === 0) {
          setNoPlacesMessage(data.message);
        } else {
          setNoPlacesMessage(null);
        }
        
        // Initialize selected shifts from existing submissions
        const initialSelections: Record<string, boolean> = {};
        (data.timesheets || []).forEach((ts: Timesheet) => {
          Object.entries(ts.existing_submissions || {}).forEach(([key, value]) => {
            // key format from API: "shiftTemplateId-shiftIndex"
            // Convert to frontend format: "timesheetId|shiftTemplateId|shiftIndex"
            const parts = key.split('-');
            if (parts.length === 2) {
              const shiftTemplateId = parts[0];
              const shiftIndex = parts[1];
              const frontendKey = `${ts.id}|${shiftTemplateId}|${shiftIndex}`;
              initialSelections[frontendKey] = value as boolean;
            }
          });
        });
        setSelectedShifts(initialSelections);
        
        // Auto-expand all timesheets if there are any
        if (data.timesheets && data.timesheets.length > 0) {
          setExpandedTimesheets(new Set(data.timesheets.map((ts: Timesheet) => ts.id)));
        }
      } else {
        console.error('Failed to fetch timesheets');
      }
    } catch (error) {
      console.error('Error fetching timesheets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const response = await fetch('/api/worker/positions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const posMap: Record<string, string> = {};
        (data.positions || []).forEach((pos: { id: string; name: string }) => {
          posMap[pos.id] = pos.name;
        });
        setPositions(posMap);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  };

  const getShiftKey = (timesheetId: string, shiftTemplateId: string, shiftIndex: number) => {
    return `${timesheetId}|${shiftTemplateId}|${shiftIndex}`;
  };

  const toggleShiftSelection = (timesheetId: string, shiftTemplateId: string, shiftIndex: number) => {
    const key = getShiftKey(timesheetId, shiftTemplateId, shiftIndex);
    setSelectedShifts(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleTimesheetExpand = (timesheetId: string) => {
    setExpandedTimesheets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(timesheetId)) {
        newSet.delete(timesheetId);
      } else {
        newSet.add(timesheetId);
      }
      return newSet;
    });
  };

  const isShiftForWorkerSkill = (positionId: string) => {
    return workerSkills.some(skill => skill.id === positionId);
  };

  const saveAvailability = async () => {
    setSaving(true);
    setSaveSuccess(null);
    
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // Build submissions array from selected shifts
      const submissions: SelectedShift[] = [];
      
      Object.entries(selectedShifts).forEach(([key, isAvailable]) => {
        const parts = key.split('|');
        if (parts.length === 3) {
          const scheduleTemplateId = parts[0];
          const shiftTemplateId = parts[1];
          const shiftIndex = parseInt(parts[2], 10);
          
          submissions.push({
            schedule_template_id: scheduleTemplateId,
            shift_template_id: shiftTemplateId,
            shift_index: shiftIndex,
            is_available: isAvailable
          });
        }
      });

      if (submissions.length === 0) {
        setSaveSuccess('No shifts selected');
        setSaving(false);
        return;
      }

      const response = await fetch('/api/worker/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ submissions }),
      });

      if (response.ok) {
        const data = await response.json();
        setSaveSuccess(data.message || 'Availability saved successfully!');
        // Refresh to get updated state
        await fetchTimesheets();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save availability');
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('An error occurred while saving availability');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDeadline = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeUntilDeadline = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 1) return `${diffDays} days left`;
    if (diffDays === 1) return '1 day left';
    if (diffHours > 1) return `${diffHours} hours left`;
    if (diffHours === 1) return '1 hour left';
    return 'Less than 1 hour left';
  };

  const getSelectedCount = (timesheetId: string) => {
    return Object.entries(selectedShifts)
      .filter(([key, value]) => {
        if (!value) return false;
        const parts = key.split('|');
        if (parts.length !== 3) return false;
        return parts[0] === timesheetId;
      })
      .length;
  };

  const getTotalHours = (timesheetId: string, shiftTemplates: ShiftTemplate[]) => {
    let total = 0;
    shiftTemplates.forEach(template => {
      if (template.day_type === 'work') {
        template.shifts.forEach((shift, index) => {
          const key = getShiftKey(timesheetId, template.id, index);
          if (selectedShifts[key]) {
            const [startH, startM] = shift.startTime.split(':').map(Number);
            const [endH, endM] = shift.endTime.split(':').map(Number);
            const hours = (endH + endM / 60) - (startH + startM / 60);
            total += hours;
          }
        });
      }
    });
    return total;
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-8">
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
          <BackButton href="/worker" />
          {timesheets.length > 0 && (
            <Button 
              onClick={saveAvailability} 
              isLoading={saving}
            >
              Save Availability
            </Button>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Set Availability</h1>
          <p className="text-foreground-muted">
            Select the shifts you are available to work
          </p>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <Card className="border-success bg-success/10">
            <CardContent className="p-4 flex items-center gap-2">
              <Check className="w-5 h-5 text-success" />
              <span className="text-success">{saveSuccess}</span>
            </CardContent>
          </Card>
        )}

        {/* No Timesheets */}
        {timesheets.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {noPlacesMessage ? 'Not Assigned to Any Locations' : 'No Currently Active Timesheets'}
              </h3>
              <p className="text-foreground-muted">
                {noPlacesMessage || 'There are no published timesheets requiring your availability at this time. Check back later or contact your manager.'}
              </p>
              {noPlacesMessage && (
                <p className="text-sm text-warning mt-4">
                  Ask your manager to assign you to a work location in the Workers page.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Timesheets List */}
        {timesheets.map((timesheet) => (
          <Card key={timesheet.id} className="overflow-hidden">
            {/* Timesheet Header */}
            <div 
              className="p-4 cursor-pointer hover:bg-background-secondary transition-colors"
              onClick={() => toggleTimesheetExpand(timesheet.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{timesheet.name}</h3>
                    <Badge variant="success">Published</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-foreground-muted">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{timesheet.places?.name || 'Unknown Place'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {formatDate(timesheet.start_date)} - {formatDate(timesheet.end_date)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="warning" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Deadline: {formatDeadline(timesheet.availability_deadline)}
                    </Badge>
                    <span className="text-xs text-foreground-muted">
                      ({getTimeUntilDeadline(timesheet.availability_deadline)})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">
                      {getSelectedCount(timesheet.id)} selected
                    </div>
                    <div className="text-xs text-foreground-muted">
                      {getTotalHours(timesheet.id, timesheet.shift_templates).toFixed(1)}h total
                    </div>
                  </div>
                  {expandedTimesheets.has(timesheet.id) ? (
                    <ChevronUp className="w-5 h-5 text-foreground-muted" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-foreground-muted" />
                  )}
                </div>
              </div>
            </div>

            {/* Shifts List */}
            {expandedTimesheets.has(timesheet.id) && (
              <div className="border-t border-border">
                {timesheet.shift_templates
                  .filter(template => template.day_type === 'work')
                  .map((template) => (
                    <div key={template.id} className="border-b border-border last:border-b-0">
                      <div className="px-4 py-2 bg-background-secondary">
                        <span className="text-sm font-medium text-foreground">
                          {formatDate(template.date)}
                        </span>
                      </div>
                      {template.shifts.map((shift, index) => {
                        const isForWorker = isShiftForWorkerSkill(shift.position);
                        const key = getShiftKey(timesheet.id, template.id, index);
                        const isSelected = selectedShifts[key] || false;
                        
                        if (!isForWorker) return null;
                        
                        return (
                          <div
                            key={`${template.id}-${index}`}
                            className={`p-4 cursor-pointer transition-all ${
                              isSelected 
                                ? 'bg-success/10 border-l-4 border-l-success' 
                                : 'hover:bg-background-secondary border-l-4 border-l-transparent'
                            }`}
                            onClick={() => toggleShiftSelection(timesheet.id, template.id, index)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Clock className="w-4 h-4 text-foreground-muted" />
                                  <span className="font-medium text-foreground">
                                    {shift.startTime} - {shift.endTime}
                                  </span>
                                  <Badge variant="default">
                                    {positions[shift.position] || 'Unknown Position'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1 text-sm text-foreground-muted">
                                  <Users className="w-4 h-4" />
                                  <span>{shift.workers} worker{shift.workers !== 1 ? 's' : ''} needed</span>
                                </div>
                              </div>
                              <div className="flex items-center">
                                {isSelected ? (
                                  <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 border-2 border-border rounded-full" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {template.shifts.filter(s => isShiftForWorkerSkill(s.position)).length === 0 && (
                        <div className="p-4 text-sm text-foreground-muted text-center">
                          No shifts for your position on this day
                        </div>
                      )}
                    </div>
                  ))}
                {timesheet.shift_templates.filter(t => t.day_type === 'work').length === 0 && (
                  <div className="p-8 text-center text-foreground-muted">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                    <p>No work days configured for this timesheet</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}

        {/* Summary */}
        {timesheets.length > 0 && Object.values(selectedShifts).some(v => v) && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-3">Availability Summary</h3>
              <div className="space-y-2">
                {timesheets.map(ts => {
                  const count = getSelectedCount(ts.id);
                  const hours = getTotalHours(ts.id, ts.shift_templates);
                  if (count === 0) return null;
                  return (
                    <div key={ts.id} className="flex justify-between text-sm">
                      <span className="text-foreground-muted">{ts.name}:</span>
                      <span className="font-medium text-foreground">
                        {count} shift{count !== 1 ? 's' : ''} ({hours.toFixed(1)}h)
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
