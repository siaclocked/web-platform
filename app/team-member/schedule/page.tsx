"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import {
  Calendar,
  Clock,
  MapPin,
  Briefcase,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { authedFetch, NotAuthenticatedError } from "@/lib/api";
import { buildMonthGrid } from "@/lib/utils";

interface Assignment {
  date: string;
  day_name: string;
  start_time: string;
  end_time: string;
  skill_id: string;
  skill_name: string;
  hours: number;
}

interface Schedule {
  id: string;
  name: string;
  place_name: string;
  start_date: string;
  end_date: string;
  assignments: Assignment[];
  total_hours: number;
}

export default function WorkerSchedulePage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const response = await authedFetch("/api/worker/schedule");

      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules || []);
      }
    } catch (error) {
      if (error instanceof NotAuthenticatedError) {
        router.push("/login");
        return;
      }
      console.error("Error fetching schedules:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Build a map: date string -> assignments
  const shiftsByDate = useMemo(() => {
    const map: Record<string, Array<Assignment & { place_name: string; schedule_name: string }>> = {};
    schedules.forEach(s => {
      s.assignments.forEach(a => {
        if (!map[a.date]) map[a.date] = [];
        map[a.date].push({ ...a, place_name: s.place_name, schedule_name: s.name });
      });
    });
    // Sort each day's shifts by start_time
    Object.keys(map).forEach(d => {
      map[d].sort((a, b) => a.start_time.localeCompare(b.start_time));
    });
    return map;
  }, [schedules]);

  // Calendar helpers
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    const todayStr = now.toISOString().split("T")[0];
    setSelectedDate(todayStr);
  };

  const monthLabel = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayStr = new Date().toISOString().split("T")[0];

  const selectedShifts = selectedDate ? shiftsByDate[selectedDate] || [] : [];

  // Total hours this month
  const monthHours = useMemo(() => {
    let total = 0;
    Object.entries(shiftsByDate).forEach(([date, shifts]) => {
      if (date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)) {
        shifts.forEach(s => { total += s.hours; });
      }
    });
    return total;
  }, [shiftsByDate, year, month]);

  const monthShiftCount = useMemo(() => {
    let count = 0;
    Object.entries(shiftsByDate).forEach(([date, shifts]) => {
      if (date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)) {
        count += shifts.length;
      }
    });
    return count;
  }, [shiftsByDate, year, month]);

  const calendarDaysGrid = buildMonthGrid(year, month);

  const getCellStyle = (dateStr: string) => {
    const shifts = shiftsByDate[dateStr];
    if (!shifts || shifts.length === 0) return '';
    return 'bg-primary/10 border-primary/40';
  };

  const getCellLabel = (dateStr: string) => {
    const shifts = shiftsByDate[dateStr];
    if (!shifts || shifts.length === 0) return null;
    if (shifts.length === 1) {
      return `${shifts[0].start_time.slice(0, 5)}`;
    }
    return `${shifts.length} shifts`;
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
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">My Schedule</h1>
          <div className="flex items-center gap-3">
            <Badge variant="info">{monthShiftCount} shift{monthShiftCount !== 1 ? "s" : ""}</Badge>
            <span className="text-sm text-foreground-muted">{monthHours.toFixed(1)}h this month</span>
          </div>
        </div>
        <p className="text-foreground-muted text-sm">
          Tap a day to see your shift details
        </p>

        {/* Calendar */}
        <Card>
          <CardContent className="p-4">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="sm" onClick={prevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="font-semibold text-foreground">{monthLabel}</h2>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-foreground-muted py-2">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {calendarDaysGrid.map((cell, idx) => {
                const isToday = cell.dateStr === todayStr;
                const isSelected = cell.dateStr === selectedDate;
                const cellStyle = getCellStyle(cell.dateStr);
                const label = getCellLabel(cell.dateStr);

                return (
                  <button
                    key={idx}
                    onClick={() => cell.isCurrentMonth && setSelectedDate(isSelected ? null : cell.dateStr)}
                    disabled={!cell.isCurrentMonth}
                    className={`relative flex flex-col items-start p-2 min-h-[72px] sm:min-h-[80px] border text-left transition-all text-xs
                      ${cell.isCurrentMonth ? 'cursor-pointer hover:bg-background-secondary' : 'opacity-30 cursor-default'}
                      ${isSelected ? 'ring-2 ring-primary' : ''}
                      ${cellStyle ? cellStyle : 'border-border/50'}
                    `}
                  >
                    <span className={`text-sm font-semibold leading-none ${isToday ? 'bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center' : ''} ${!cell.isCurrentMonth ? 'text-foreground-muted/40' : 'text-foreground'}`}>
                      {cell.day}
                    </span>
                    {label && (
                      <span className="mt-auto text-[10px] sm:text-xs text-primary font-medium truncate w-full">
                        {label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-foreground-muted">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-primary/10 border border-primary/40" />
                Shift scheduled
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-border/50" />
                No shift
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-primary" />
                Today
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected day detail */}
        {selectedDate && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>
                {selectedShifts.length > 0 && (
                  <Badge variant="info">
                    {selectedShifts.reduce((acc, s) => acc + s.hours, 0).toFixed(1)}h total
                  </Badge>
                )}
              </div>

              {selectedShifts.length === 0 ? (
                <p className="text-sm text-foreground-muted py-2">No shifts scheduled for this day.</p>
              ) : (
                <div className="space-y-3">
                  {selectedShifts.map((shift, idx) => (
                    <div
                      key={`${shift.date}-${idx}`}
                      className="p-3 bg-primary/5 border border-primary/20 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-foreground">
                            {shift.start_time} – {shift.end_time}
                          </span>
                        </div>
                        <Badge variant="default">{shift.hours.toFixed(1)}h</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-foreground-muted">
                        <span className="flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5" />
                          {shift.skill_name}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {shift.place_name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {schedules.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
              <h3 className="text-lg font-medium mb-2">No shifts scheduled</h3>
              <p className="text-foreground-muted">
                You don&apos;t have any shifts assigned yet. Check back after
                your manager generates a schedule.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
