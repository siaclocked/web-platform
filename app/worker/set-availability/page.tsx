'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button } from '@/components/ui';
import { ChevronLeft, ChevronRight, Check, X, Clock, Copy, Sun, Palmtree } from 'lucide-react';

type AvailabilityType = 'available_all_day' | 'available_range' | 'unavailable' | 'vacation';

interface AvailabilityEntry {
  date: string;
  availability_type: AvailabilityType;
  start_time?: string | null;
  end_time?: string | null;
}

// Map of date string → availability entry
type AvailabilityMap = Record<string, AvailabilityEntry>;

export default function SetAvailabilityPage() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  // For the detail panel
  const [panelType, setPanelType] = useState<AvailabilityType>('available_all_day');
  const [panelStart, setPanelStart] = useState('09:00');
  const [panelEnd, setPanelEnd] = useState('17:00');

  // Copy mode
  const [copySource, setCopySource] = useState<string | null>(null);
  const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());

  const mYear = currentMonth.getFullYear();
  const mMonth = currentMonth.getMonth();
  const daysInMonth = new Date(mYear, mMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(mYear, mMonth, 1).getDay();
  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayStr = new Date().toISOString().split('T')[0];

  // Build calendar grid
  const calendarDays: Array<{ day: number; dateStr: string; isCurrentMonth: boolean }> = [];
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
  const remainingCells = 7 - (calendarDays.length % 7);
  if (remainingCells < 7) {
    for (let d = 1; d <= remainingCells; d++) {
      const nm = mMonth + 2 > 12 ? 1 : mMonth + 2;
      const ny = mMonth + 2 > 12 ? mYear + 1 : mYear;
      calendarDays.push({ day: d, dateStr: `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
    }
  }

  const fetchAvailability = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const token = session.access_token;

      // Fetch a wide range (3 months around current month)
      const start = new Date(mYear, mMonth - 1, 1).toISOString().split('T')[0];
      const end = new Date(mYear, mMonth + 2, 0).toISOString().split('T')[0];

      const response = await fetch(
        `/api/worker/availability-calendar?start_date=${start}&end_date=${end}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const map: AvailabilityMap = {};
        (data.entries || []).forEach((e: AvailabilityEntry & { date: string }) => {
          map[e.date] = {
            date: e.date,
            availability_type: e.availability_type,
            start_time: e.start_time,
            end_time: e.end_time,
          };
        });
        setAvailability(map);
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setIsLoading(false);
    }
  }, [mYear, mMonth]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // When selecting a date, load its existing data into the panel
  const handleSelectDate = (dateStr: string) => {
    if (copySource) {
      // In copy mode: toggle target
      setCopyTargets(prev => {
        const next = new Set(prev);
        if (next.has(dateStr)) next.delete(dateStr);
        else next.add(dateStr);
        return next;
      });
      return;
    }

    setSelectedDate(dateStr);
    setSaveMessage(null);
    const existing = availability[dateStr];
    if (existing) {
      setPanelType(existing.availability_type);
      setPanelStart(existing.start_time?.slice(0, 5) || '09:00');
      setPanelEnd(existing.end_time?.slice(0, 5) || '17:00');
    } else {
      setPanelType('available_all_day');
      setPanelStart('09:00');
      setPanelEnd('17:00');
    }
  };

  const setDayAvailability = (dateStr: string, type: AvailabilityType, startTime?: string, endTime?: string) => {
    setAvailability(prev => ({
      ...prev,
      [dateStr]: {
        date: dateStr,
        availability_type: type,
        start_time: type === 'available_range' ? startTime || null : null,
        end_time: type === 'available_range' ? endTime || null : null,
      }
    }));
    setDirty(prev => new Set(prev).add(dateStr));
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

  const handleApply = () => {
    if (!selectedDate) return;
    if (panelType === 'available_range') {
      if (!panelStart || !panelEnd || panelStart.length < 5 || panelEnd.length < 5) {
        alert('Please enter valid start and end times in HH:MM format');
        return;
      }
      const [sh, sm] = panelStart.split(':').map(Number);
      const [eh, em] = panelEnd.split(':').map(Number);
      if (eh * 60 + em <= sh * 60 + sm) {
        alert('End time must be after start time');
        return;
      }
    }
    setDayAvailability(selectedDate, panelType, panelStart, panelEnd);
    setSelectedDate(null);
  };

  const handleRemove = () => {
    if (!selectedDate) return;
    setAvailability(prev => {
      const next = { ...prev };
      delete next[selectedDate];
      return next;
    });
    setDirty(prev => new Set(prev).add(selectedDate));
    setSelectedDate(null);
  };

  // Copy mode
  const startCopy = () => {
    if (!selectedDate || !availability[selectedDate]) return;
    setCopySource(selectedDate);
    setCopyTargets(new Set());
  };

  const applyCopy = () => {
    if (!copySource || !availability[copySource]) return;
    const source = availability[copySource];
    copyTargets.forEach(target => {
      setDayAvailability(target, source.availability_type, source.start_time || undefined, source.end_time || undefined);
    });
    setCopySource(null);
    setCopyTargets(new Set());
  };

  const cancelCopy = () => {
    setCopySource(null);
    setCopyTargets(new Set());
  };

  // Save all dirty entries
  const handleSave = async () => {
    if (dirty.size === 0) return;
    setSaving(true);
    setSaveMessage(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const token = session.access_token;

      // Entries that exist in availability map (upsert)
      const entriesToSave: AvailabilityEntry[] = [];
      // Entries that were removed (delete)
      const datesToDelete: string[] = [];

      dirty.forEach(dateStr => {
        if (availability[dateStr]) {
          entriesToSave.push(availability[dateStr]);
        } else {
          datesToDelete.push(dateStr);
        }
      });

      // Save entries
      if (entriesToSave.length > 0) {
        const res = await fetch('/api/worker/availability-calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ entries: entriesToSave }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to save');
        }
      }

      // Delete removed entries
      if (datesToDelete.length > 0) {
        const res = await fetch('/api/worker/availability-calendar', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ dates: datesToDelete }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to delete');
        }
      }

      setDirty(new Set());
      setSaveMessage('Availability saved!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Save failed';
      setSaveMessage(`Error: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const getCellColor = (dateStr: string) => {
    const entry = availability[dateStr];
    if (!entry) return '';
    switch (entry.availability_type) {
      case 'available_all_day': return 'bg-success/15 border-success';
      case 'available_range': return 'bg-accent/15 border-accent';
      case 'unavailable': return 'bg-danger/10 border-danger/50';
      case 'vacation': return 'bg-purple-500/15 border-purple-500/50';
    }
  };

  const getCellLabel = (dateStr: string) => {
    const entry = availability[dateStr];
    if (!entry) return null;
    switch (entry.availability_type) {
      case 'available_all_day': return 'All day';
      case 'available_range': return `${entry.start_time?.slice(0, 5)} – ${entry.end_time?.slice(0, 5)}`;
      case 'unavailable': return 'Off';
      case 'vacation': return 'Vacation';
    }
  };

  const selectedEntry = selectedDate ? availability[selectedDate] : null;

  return (
    <PageContainer>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Availability</h1>
          <Button onClick={handleSave} isLoading={saving} disabled={dirty.size === 0}>
            Save ({dirty.size})
          </Button>
        </div>
        <p className="text-foreground-muted text-sm">
          Click on a day to set when you can work. The scheduler will use this to assign your shifts.
        </p>

        {saveMessage && (
          <div className={`p-3 rounded-lg text-sm ${saveMessage.startsWith('Error') ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
            {saveMessage}
          </div>
        )}

        {/* Copy mode banner */}
        {copySource && (
          <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Copy className="w-4 h-4 text-accent" />
              <span className="text-foreground">
                Copying from <strong>{copySource}</strong> — click days to select targets ({copyTargets.size} selected)
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={applyCopy} disabled={copyTargets.size === 0}>Apply</Button>
              <Button size="sm" variant="outline" onClick={cancelCopy}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Calendar */}
        <Card>
          <CardContent className="p-4">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(mYear, mMonth - 1, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="font-semibold text-foreground">{monthLabel}</h2>
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(mYear, mMonth + 1, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-foreground-muted py-2">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map((cell, idx) => {
                  const isToday = cell.dateStr === todayStr;
                  const isSelected = cell.dateStr === selectedDate;
                  const isCopyTarget = copyTargets.has(cell.dateStr);
                  const cellColor = getCellColor(cell.dateStr);
                  const label = getCellLabel(cell.dateStr);
                  const isDirtyCell = dirty.has(cell.dateStr);

                  return (
                    <button
                      key={idx}
                      onClick={() => cell.isCurrentMonth && handleSelectDate(cell.dateStr)}
                      disabled={!cell.isCurrentMonth}
                      className={`relative flex flex-col items-start p-2 min-h-[72px] sm:min-h-[80px] border text-left transition-all text-xs
                        ${cell.isCurrentMonth ? 'cursor-pointer hover:bg-background-secondary' : 'opacity-30 cursor-default'}
                        ${isSelected ? 'ring-2 ring-primary' : ''}
                        ${isCopyTarget ? 'ring-2 ring-accent' : ''}
                        ${cellColor ? cellColor : 'border-border/50'}
                      `}
                    >
                      <span className={`text-sm font-semibold leading-none ${isToday ? 'bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center' : ''} ${!cell.isCurrentMonth ? 'text-foreground-muted/40' : 'text-foreground'}`}>
                        {cell.day}
                      </span>
                      {label && (
                        <span className="mt-auto text-[10px] sm:text-xs text-foreground-muted truncate w-full">
                          {label}
                        </span>
                      )}
                      {isDirtyCell && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-warning rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-foreground-muted">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-success/30 border border-success" />
                Available all day
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-accent/30 border border-accent" />
                Available (hours)
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-danger/20 border border-danger/50" />
                Not available
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                Unsaved
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Day detail panel */}
        {selectedDate && !copySource && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <button onClick={() => setSelectedDate(null)} className="text-foreground-muted hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Type selector */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  onClick={() => setPanelType('available_all_day')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-sm transition-all
                    ${panelType === 'available_all_day' ? 'border-success bg-success/10 text-success font-semibold' : 'border-border hover:bg-background-secondary text-foreground'}`}
                >
                  <Sun className="w-5 h-5" />
                  All Day
                </button>
                <button
                  onClick={() => setPanelType('available_range')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-sm transition-all
                    ${panelType === 'available_range' ? 'border-accent bg-accent/10 text-accent font-semibold' : 'border-border hover:bg-background-secondary text-foreground'}`}
                >
                  <Clock className="w-5 h-5" />
                  Hours
                </button>
                <button
                  onClick={() => setPanelType('unavailable')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-sm transition-all
                    ${panelType === 'unavailable' ? 'border-danger bg-danger/10 text-danger font-semibold' : 'border-border hover:bg-background-secondary text-foreground'}`}
                >
                  <X className="w-5 h-5" />
                  Off
                </button>
              </div>

              {/* Time range inputs (24-hour format) */}
              {panelType === 'available_range' && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1">
                    <label className="block text-xs text-foreground-muted mb-1">From</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={panelStart}
                      onChange={(e) => setPanelStart(formatTimeInput(e.target.value, panelStart))}
                      placeholder="09:00"
                      maxLength={5}
                      className="w-full p-2 border border-border rounded-lg text-sm bg-background text-center font-mono"
                    />
                  </div>
                  <span className="text-foreground-muted mt-5">–</span>
                  <div className="flex-1">
                    <label className="block text-xs text-foreground-muted mb-1">To</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={panelEnd}
                      onChange={(e) => setPanelEnd(formatTimeInput(e.target.value, panelEnd))}
                      placeholder="17:00"
                      maxLength={5}
                      className="w-full p-2 border border-border rounded-lg text-sm bg-background text-center font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={handleApply} className="flex-1">
                  <Check className="w-4 h-4 mr-1" />
                  Set
                </Button>
                {selectedEntry && (
                  <Button variant="outline" onClick={startCopy}>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                )}
                {selectedEntry && (
                  <Button variant="danger" onClick={handleRemove}>
                    Remove
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
