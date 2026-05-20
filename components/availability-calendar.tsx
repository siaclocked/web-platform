'use client';

import { memo, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, Button } from '@/components/ui';
import { ChevronLeft, ChevronRight, X, Clock, Palmtree, HelpCircle, Undo2 } from 'lucide-react';
import { authedFetch } from '@/lib/api';
import { buildMonthGrid } from '@/lib/utils';

// Semantics: a worker is **available by default** on every date. Only explicit
// exceptions are stored — partial hours, full-day off, vacation.
// Legacy `available_all_day` rows are filtered out on load — same meaning as no row.
type ExceptionType = 'available_range' | 'unavailable' | 'vacation';
type StoredType = ExceptionType | 'available_all_day';

interface AvailabilityEntry {
  date: string;
  availability_type: ExceptionType;
  start_time?: string | null;
  end_time?: string | null;
}

type AvailabilityMap = Record<string, AvailabilityEntry>;

interface AvailabilityCalendarProps {
  apiEndpoint: string;
  targetWorkerId?: string;
  heading?: string;
  description?: string;
}

const HELP_DISMISS_KEY = 'availability-help-dismissed';

// Per-type colour vocab. Used by both calendar cells, type chips, and the legend.
const TYPE_TOKENS: Record<ExceptionType, { cell: string; chipActive: string; chipIdle: string; legendSwatch: string; legendLabel: string }> = {
  unavailable: {
    cell: 'bg-danger/10 border-danger/50',
    chipActive: 'border-danger bg-danger/10 text-danger font-semibold',
    chipIdle: 'border-border hover:border-danger/40 hover:bg-danger/5 text-foreground',
    legendSwatch: 'bg-danger/20 border border-danger/50',
    legendLabel: 'Off',
  },
  available_range: {
    cell: 'bg-warning/15 border-warning/60',
    chipActive: 'border-warning bg-warning/10 text-warning font-semibold',
    chipIdle: 'border-border hover:border-warning/40 hover:bg-warning/5 text-foreground',
    legendSwatch: 'bg-warning/30 border border-warning/60',
    legendLabel: 'Partial hours',
  },
  vacation: {
    cell: 'bg-purple-500/15 border-purple-500/50',
    chipActive: 'border-purple-500 bg-purple-500/10 text-purple-600 font-semibold',
    chipIdle: 'border-border hover:border-purple-500/40 hover:bg-purple-500/5 text-foreground',
    legendSwatch: 'bg-purple-500/20 border border-purple-500/50',
    legendLabel: 'Vacation',
  },
};

export function AvailabilityCalendar({
  apiEndpoint,
  targetWorkerId,
  heading,
  description,
}: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
  const [saveError, setSaveError] = useState<string>('');
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  // Drag-to-select: anchor + current hover. The selected range is derived from these.
  const [dragAnchor, setDragAnchor] = useState<string | null>(null);
  const [dragHover, setDragHover] = useState<string | null>(null);

  // Undo: previous entry of the last cleared date, kept for ~5s for one-click revert.
  const [pendingUndo, setPendingUndo] = useState<{ date: string; previous: AvailabilityEntry } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cache of months we've already fetched. Key: "${apiEndpoint}|${targetWorkerId||'self'}|${yyyy-MM}".
  // Lets us flip between adjacent months without re-fetching the same data and flickering the spinner.
  const fetchedKeysRef = useRef<Set<string>>(new Set());
  // Latest `dirty` set, read inside the merge updater to preserve user edits during a refetch.
  const dirtyRef = useRef<Set<string>>(dirty);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  const [helpDismissed, setHelpDismissed] = useState(true);
  useEffect(() => {
    setHelpDismissed(typeof window !== 'undefined' && localStorage.getItem(HELP_DISMISS_KEY) === '1');
  }, []);
  const dismissHelp = () => {
    setHelpDismissed(true);
    if (typeof window !== 'undefined') localStorage.setItem(HELP_DISMISS_KEY, '1');
  };
  const reopenHelp = () => {
    setHelpDismissed(false);
    if (typeof window !== 'undefined') localStorage.removeItem(HELP_DISMISS_KEY);
  };

  const mYear = currentMonth.getFullYear();
  const mMonth = currentMonth.getMonth();
  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayStr = new Date().toISOString().split('T')[0];

  const calendarDays = useMemo(() => buildMonthGrid(mYear, mMonth), [mYear, mMonth]);
  const inMonthIndex = useMemo(() => {
    const map = new Map<string, number>();
    let i = 0;
    for (const c of calendarDays) {
      if (c.isCurrentMonth) {
        map.set(c.dateStr, i);
        i++;
      }
    }
    return map;
  }, [calendarDays]);
  const inMonthDates = useMemo(() => calendarDays.filter(c => c.isCurrentMonth).map(c => c.dateStr), [calendarDays]);

  const dragRange = useMemo(() => {
    if (!dragAnchor) return new Set<string>();
    const hover = dragHover || dragAnchor;
    const a = inMonthIndex.get(dragAnchor);
    const b = inMonthIndex.get(hover);
    if (a === undefined || b === undefined) return new Set([dragAnchor]);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    return new Set(inMonthDates.slice(lo, hi + 1));
  }, [dragAnchor, dragHover, inMonthDates, inMonthIndex]);

  // Build the 3 month keys we'd cover with a fetch around (mYear, mMonth).
  const buildMonthKeys = useCallback((year: number, month: number) => {
    const prefix = `${apiEndpoint}|${targetWorkerId || 'self'}`;
    const keys: string[] = [];
    for (let offset = -1; offset <= 1; offset++) {
      const d = new Date(year, month + offset, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      keys.push(`${prefix}|${yyyy}-${mm}`);
    }
    return keys;
  }, [apiEndpoint, targetWorkerId]);

  const fetchAvailability = useCallback(async () => {
    const monthKeys = buildMonthKeys(mYear, mMonth);
    if (monthKeys.every(k => fetchedKeysRef.current.has(k))) {
      // Cache hit — data already in `availability` from a prior fetch.
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const start = new Date(mYear, mMonth - 1, 1).toISOString().split('T')[0];
      const end = new Date(mYear, mMonth + 2, 0).toISOString().split('T')[0];

      const params = new URLSearchParams({ start_date: start, end_date: end });
      if (targetWorkerId) params.set('worker_id', targetWorkerId);

      const response = await authedFetch(`${apiEndpoint}?${params}`);

      if (response.ok) {
        const data = await response.json();
        type EntryRow = { date: string; availability_type: StoredType; start_time?: string | null; end_time?: string | null };
        const entries = (data.entries as EntryRow[] || []);
        // Merge into existing state, preserving any dirty (unsaved) edits.
        setAvailability(prev => {
          const next = { ...prev };
          const dirtyNow = dirtyRef.current;
          for (const e of entries) {
            if (e.availability_type === 'available_all_day') continue;
            if (dirtyNow.has(e.date)) continue;
            next[e.date] = {
              date: e.date,
              availability_type: e.availability_type,
              start_time: e.start_time,
              end_time: e.end_time,
            };
          }
          return next;
        });
        monthKeys.forEach(k => fetchedKeysRef.current.add(k));
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiEndpoint, targetWorkerId, mYear, mMonth, buildMonthKeys]);

  // When the target (endpoint or worker) changes, invalidate cache and local state.
  useEffect(() => {
    fetchedKeysRef.current = new Set();
    setAvailability({});
    setDirty(new Set());
    setSaveResult(null);
    setSaveError('');
  }, [apiEndpoint, targetWorkerId]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (saveResetTimerRef.current) clearTimeout(saveResetTimerRef.current);
    };
  }, []);

  const applyException = useCallback(
    (dates: string[], type: ExceptionType, opts?: { start_time?: string | null; end_time?: string | null }) => {
      setAvailability(prev => {
        const next = { ...prev };
        for (const d of dates) {
          next[d] = {
            date: d,
            availability_type: type,
            start_time: type === 'available_range' ? opts?.start_time ?? '09:00' : null,
            end_time: type === 'available_range' ? opts?.end_time ?? '17:00' : null,
          };
        }
        return next;
      });
      setDirty(prev => {
        const next = new Set(prev);
        dates.forEach(d => next.add(d));
        return next;
      });
    },
    [],
  );

  const removeException = useCallback((dates: string[]) => {
    // Capture previous entry for undo (only for single-date removes — bulk clears are rarely undone).
    const lastDate = dates[dates.length - 1];
    const lastPrev = availability[lastDate] || null;

    setAvailability(prev => {
      const next = { ...prev };
      for (const d of dates) delete next[d];
      return next;
    });
    setDirty(prev => {
      const next = new Set(prev);
      dates.forEach(d => next.add(d));
      return next;
    });

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (lastPrev && dates.length === 1) {
      setPendingUndo({ date: lastDate, previous: lastPrev });
      undoTimerRef.current = setTimeout(() => setPendingUndo(null), 5000);
    } else {
      setPendingUndo(null);
    }
  }, [availability]);

  const undoLastRemove = () => {
    if (!pendingUndo) return;
    setAvailability(prev => ({ ...prev, [pendingUndo.date]: pendingUndo.previous }));
    setDirty(prev => new Set(prev).add(pendingUndo.date));
    setPendingUndo(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  };

  const handleCellActivate = useCallback((dateStr: string) => {
    const existing = availability[dateStr];
    if (!existing) applyException([dateStr], 'unavailable');
    setSelectedDate(dateStr);
    setFocusedDate(dateStr);
  }, [availability, applyException]);

  // Drag handlers: latest state read via refs to avoid resubscribing the global
  // pointerup listener on every cell hover.
  const dragStateRef = useRef({ anchor: null as string | null, hover: null as string | null });
  useEffect(() => {
    dragStateRef.current = { anchor: dragAnchor, hover: dragHover };
  }, [dragAnchor, dragHover]);

  // Stable handlers (empty deps) — read latest drag state from a ref so memo'd cells aren't invalidated.
  const handlePointerDown = useCallback((dateStr: string, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return;
    setDragAnchor(dateStr);
    setDragHover(dateStr);
  }, []);
  const handlePointerEnter = useCallback((dateStr: string, isCurrentMonth: boolean) => {
    const { anchor, hover } = dragStateRef.current;
    if (!anchor || !isCurrentMonth) return;
    if (dateStr === hover) return;
    setDragHover(dateStr);
  }, []);

  useEffect(() => {
    if (!dragAnchor) return;
    const onUp = () => {
      const { anchor, hover } = dragStateRef.current;
      if (!anchor) return;
      const a = inMonthIndex.get(anchor);
      const b = inMonthIndex.get(hover || anchor);
      if (a === undefined || b === undefined) {
        setDragAnchor(null);
        setDragHover(null);
        return;
      }
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const dates = inMonthDates.slice(lo, hi + 1);

      if (dates.length === 1) {
        handleCellActivate(dates[0]);
      } else if (dates.length > 1) {
        applyException(dates, 'unavailable');
        const last = dates[dates.length - 1];
        setSelectedDate(last);
        setFocusedDate(last);
      }
      setDragAnchor(null);
      setDragHover(null);
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [dragAnchor, inMonthDates, inMonthIndex, applyException, handleCellActivate]);

  // Keyboard nav: window-level so it works without explicit focus on the calendar div.
  // Active when user has any selected/focused date and is not typing in an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (!focusedDate && !selectedDate) return;

      const moveFocus = (deltaDays: number) => {
        const anchor = focusedDate || selectedDate || todayStr;
        const base = new Date(anchor + 'T00:00:00');
        base.setDate(base.getDate() + deltaDays);
        const next = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
        if (base.getFullYear() !== mYear || base.getMonth() !== mMonth) {
          setCurrentMonth(new Date(base.getFullYear(), base.getMonth(), 1));
        }
        setFocusedDate(next);
      };

      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); moveFocus(-1); break;
        case 'ArrowRight': e.preventDefault(); moveFocus(1); break;
        case 'ArrowUp': e.preventDefault(); moveFocus(-7); break;
        case 'ArrowDown': e.preventDefault(); moveFocus(7); break;
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (focusedDate) {
            const existing = availability[focusedDate];
            if (existing) removeException([focusedDate]);
            else applyException([focusedDate], 'unavailable');
            setSelectedDate(focusedDate);
          }
          break;
        }
        case 'h':
        case 'H':
          if (focusedDate) {
            applyException([focusedDate], 'available_range', availability[focusedDate] ?? undefined);
            setSelectedDate(focusedDate);
          }
          break;
        case 'v':
        case 'V':
          if (focusedDate) {
            applyException([focusedDate], 'vacation');
            setSelectedDate(focusedDate);
          }
          break;
        case 'Escape':
          setSelectedDate(null);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedDate, selectedDate, todayStr, mYear, mMonth, availability, applyException, removeException]);

  const handleSave = async () => {
    if (dirty.size === 0) return;
    setSaving(true);
    setSaveResult(null);
    setSaveError('');

    try {
      const entriesToSave: AvailabilityEntry[] = [];
      const datesToDelete: string[] = [];

      dirty.forEach(dateStr => {
        if (availability[dateStr]) entriesToSave.push(availability[dateStr]);
        else datesToDelete.push(dateStr);
      });

      const bodyExtra = targetWorkerId ? { worker_id: targetWorkerId } : {};

      if (entriesToSave.length > 0) {
        const res = await authedFetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...bodyExtra, entries: entriesToSave }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to save');
        }
      }

      if (datesToDelete.length > 0) {
        const res = await authedFetch(apiEndpoint, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...bodyExtra, dates: datesToDelete }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to delete');
        }
      }

      setDirty(new Set());
      setSaveResult('success');
      setPendingUndo(null);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Save failed';
      setSaveResult('error');
      setSaveError(message);
    } finally {
      setSaving(false);
      if (saveResetTimerRef.current) clearTimeout(saveResetTimerRef.current);
      saveResetTimerRef.current = setTimeout(() => {
        setSaveResult(null);
        setSaveError('');
      }, 2500);
    }
  };

  const cellLabel = (dateStr: string) => {
    const entry = availability[dateStr];
    if (!entry) return null;
    if (entry.availability_type === 'available_range') {
      return `${entry.start_time?.slice(0, 5)}–${entry.end_time?.slice(0, 5)}`;
    }
    return TYPE_TOKENS[entry.availability_type].legendLabel;
  };

  const cellClasses = (cell: { dateStr: string; isCurrentMonth: boolean; dow: number }) => {
    const isToday = cell.dateStr === todayStr;
    const isSelected = cell.dateStr === selectedDate;
    const isFocused = cell.dateStr === focusedDate;
    const isInDrag = dragRange.has(cell.dateStr);
    const isWeekend = cell.dow === 0 || cell.dow === 6;
    const entry = availability[cell.dateStr];
    const tone = cell.isCurrentMonth && entry ? TYPE_TOKENS[entry.availability_type].cell : '';

    return [
      'relative flex flex-col items-start p-2 min-h-[72px] sm:min-h-[80px] border text-left transition-colors text-xs',
      cell.isCurrentMonth ? 'cursor-pointer hover:bg-background-secondary' : 'opacity-30 cursor-default',
      isWeekend && cell.isCurrentMonth && !tone ? 'bg-background-secondary/40' : '',
      isSelected ? 'ring-2 ring-primary z-10' : '',
      isFocused && !isSelected ? 'ring-2 ring-primary/40' : '',
      isInDrag ? 'ring-2 ring-accent z-10' : '',
      tone || 'border-border/50',
      isToday ? '' : '', // placeholder, today is highlighted via the day number circle
    ].filter(Boolean).join(' ');
  };

  const selectedEntry = selectedDate ? availability[selectedDate] : null;

  const saveButtonVariant =
    saveResult === 'success' ? 'success'
    : saveResult === 'error' ? 'danger'
    : 'primary';
  const saveButtonLabel =
    saveResult === 'success' ? 'Saved!'
    : saveResult === 'error' ? 'Save failed — retry'
    : `Save (${dirty.size})`;

  return (
    <div className="space-y-4">
      {(heading || description) && (
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            {heading && <h1 className="text-2xl font-bold text-foreground">{heading}</h1>}
            {description && <p className="text-foreground-muted text-sm">{description}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleSave} variant={saveButtonVariant} isLoading={saving} disabled={dirty.size === 0 && saveResult === null}>
              {saveButtonLabel}
            </Button>
            {saveResult === 'error' && saveError && (
              <span className="text-xs text-danger">{saveError}</span>
            )}
          </div>
        </div>
      )}

      {!helpDismissed ? (
        <div className="p-3 rounded-lg bg-success-muted/30 border border-success/30 text-sm text-foreground flex items-start justify-between gap-3">
          <div>
            <strong className="text-success">Every day is available by default.</strong>{' '}
            Click a day to mark it <strong>off</strong>. Use the editor that appears to switch to <strong>partial hours</strong> or <strong>vacation</strong>.
            Drag across cells to mark a range. Arrow keys + Enter / H / V also work.
          </div>
          <button
            onClick={dismissHelp}
            className="text-xs text-foreground-muted hover:text-foreground px-2 py-1 rounded shrink-0"
            aria-label="Dismiss help"
          >
            Got it
          </button>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            onClick={reopenHelp}
            className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground"
            aria-label="Show help"
          >
            <HelpCircle className="w-3 h-3" />
            How does this work?
          </button>
        </div>
      )}

      {selectedDate && (
        <EditorBar
          date={selectedDate}
          entry={selectedEntry}
          onChange={(type, opts) => applyException([selectedDate], type, opts)}
          onRemove={() => { removeException([selectedDate]); setSelectedDate(null); }}
          onClose={() => setSelectedDate(null)}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(mYear, mMonth - 1, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="font-semibold text-foreground">{monthLabel}</h2>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(mYear, mMonth + 1, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d, i) => (
              <div
                key={d}
                className={`text-center text-xs font-semibold py-2 ${i === 5 || i === 6 ? 'text-foreground-muted/80' : 'text-foreground-muted'}`}
              >
                {d}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-7 select-none">
              {calendarDays.map((cell) => (
                <DayCell
                  key={cell.dateStr + (cell.isCurrentMonth ? 'i' : 'o')}
                  dateStr={cell.dateStr}
                  day={cell.day}
                  isCurrentMonth={cell.isCurrentMonth}
                  isToday={cell.dateStr === todayStr}
                  className={cellClasses(cell)}
                  label={cell.isCurrentMonth ? cellLabel(cell.dateStr) : null}
                  isDirty={dirty.has(cell.dateStr)}
                  onPointerDown={handlePointerDown}
                  onPointerEnter={handlePointerEnter}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-foreground-muted">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border border-border/50" />
              Available (default)
            </div>
            {(['unavailable', 'available_range', 'vacation'] as const).map(t => (
              <div key={t} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded ${TYPE_TOKENS[t].legendSwatch}`} />
                {TYPE_TOKENS[t].legendLabel}
              </div>
            ))}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-warning" />
              Unsaved
            </div>
          </div>
        </CardContent>
      </Card>

      {pendingUndo && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-foreground text-background rounded-lg shadow-lg px-4 py-3 text-sm">
          <span>Exception removed from {new Date(pendingUndo.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <button
            onClick={undoLastRemove}
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:no-underline"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

interface EditorBarProps {
  date: string;
  entry: AvailabilityEntry | null;
  onChange: (type: ExceptionType, opts?: { start_time?: string | null; end_time?: string | null }) => void;
  onRemove: () => void;
  onClose: () => void;
}

function EditorBar({ date, entry, onChange, onRemove, onClose }: EditorBarProps) {
  const currentType = entry?.availability_type ?? null;
  const [startTime, setStartTime] = useState(entry?.start_time?.slice(0, 5) || '09:00');
  const [endTime, setEndTime] = useState(entry?.end_time?.slice(0, 5) || '17:00');

  useEffect(() => {
    setStartTime(entry?.start_time?.slice(0, 5) || '09:00');
    setEndTime(entry?.end_time?.slice(0, 5) || '17:00');
  }, [date, entry?.start_time, entry?.end_time]);

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const handleType = (type: ExceptionType) => {
    if (type === 'available_range') {
      onChange('available_range', { start_time: startTime, end_time: endTime });
    } else {
      onChange(type);
    }
  };

  const commitTime = (nextStart: string, nextEnd: string) => {
    if (!nextStart || !nextEnd) return;
    const [sh, sm] = nextStart.split(':').map(Number);
    const [eh, em] = nextEnd.split(':').map(Number);
    if (eh * 60 + em <= sh * 60 + sm) return;
    onChange('available_range', { start_time: nextStart, end_time: nextEnd });
  };

  return (
    <Card className="border-primary/30">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-xs text-foreground-muted uppercase tracking-wide font-semibold">Editing</p>
            <p className="text-sm font-semibold text-foreground truncate">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground p-1 -m-1" aria-label="Close editor">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TypeChip type="unavailable" active={currentType === 'unavailable'} icon={<X className="w-3.5 h-3.5" />} onClick={() => handleType('unavailable')} />
          <TypeChip type="available_range" active={currentType === 'available_range'} icon={<Clock className="w-3.5 h-3.5" />} onClick={() => handleType('available_range')} />
          <TypeChip type="vacation" active={currentType === 'vacation'} icon={<Palmtree className="w-3.5 h-3.5" />} onClick={() => handleType('vacation')} />

          {currentType === 'available_range' && (
            <div className="flex items-center gap-2 ml-1">
              <input
                type="time"
                value={startTime}
                onChange={(e) => { setStartTime(e.target.value); commitTime(e.target.value, endTime); }}
                className="p-1.5 border border-border rounded text-xs bg-background text-foreground font-mono"
              />
              <span className="text-foreground-muted text-xs">–</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => { setEndTime(e.target.value); commitTime(startTime, e.target.value); }}
                className="p-1.5 border border-border rounded text-xs bg-background text-foreground font-mono"
              />
            </div>
          )}

          {entry && (
            <Button size="sm" variant="outline" onClick={onRemove} className="ml-auto">
              Remove exception
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface TypeChipProps {
  type: ExceptionType;
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}

interface DayCellProps {
  dateStr: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  className: string;
  label: string | null;
  isDirty: boolean;
  onPointerDown: (dateStr: string, isCurrentMonth: boolean) => void;
  onPointerEnter: (dateStr: string, isCurrentMonth: boolean) => void;
}

const DayCell = memo(function DayCell({
  dateStr,
  day,
  isCurrentMonth,
  isToday,
  className,
  label,
  isDirty,
  onPointerDown,
  onPointerEnter,
}: DayCellProps) {
  const dayClass = isToday
    ? 'bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold leading-none'
    : `text-sm font-semibold leading-none ${isCurrentMonth ? 'text-foreground' : 'text-foreground-muted/40'}`;

  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onPointerDown(dateStr, isCurrentMonth); }}
      onPointerEnter={() => onPointerEnter(dateStr, isCurrentMonth)}
      disabled={!isCurrentMonth}
      className={className}
    >
      <span className={dayClass}>{day}</span>
      {label && (
        <span className="mt-auto text-[10px] sm:text-xs text-foreground-muted truncate w-full">{label}</span>
      )}
      {isDirty && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-warning rounded-full" />
      )}
    </button>
  );
});

function TypeChip({ type, active, icon, onClick }: TypeChipProps) {
  const tokens = TYPE_TOKENS[type];
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm transition-colors ${active ? tokens.chipActive : tokens.chipIdle}`}
    >
      {icon}
      {tokens.legendLabel}
    </button>
  );
}
