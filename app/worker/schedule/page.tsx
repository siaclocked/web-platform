"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { BackButton } from "@/components/ui";
import {
  Calendar,
  Clock,
  MapPin,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/worker/schedule", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules || []);
      }
    } catch (error) {
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
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

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

  const calendarDays: Array<{ day: number; dateStr: string } | null> = [];
  // Pad leading blanks
  for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calendarDays.push({ day: d, dateStr });
  }

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
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/worker" label="Back to Dashboard" className="mb-4" />
          <h1 className="text-2xl font-bold text-foreground">My Schedule</h1>
          <p className="text-foreground-muted">Tap a day to see your shifts</p>
        </div>

        {/* Month summary */}
        <div className="flex items-center gap-4 mb-4">
          <Badge variant="info">{monthShiftCount} shift{monthShiftCount !== 1 ? "s" : ""}</Badge>
          <span className="text-sm text-foreground-muted">{monthHours.toFixed(1)}h this month</span>
        </div>

        {/* Calendar */}
        <Card className="mb-4">
          <CardContent className="p-4">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="sm" onClick={prevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-foreground">{monthLabel}</h2>
                <Button variant="outline" size="sm" onClick={goToToday} className="text-xs">
                  Today
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="text-center text-xs font-medium text-foreground-muted py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((cell, idx) => {
                if (!cell) {
                  return <div key={`blank-${idx}`} className="aspect-square" />;
                }

                const hasShifts = !!shiftsByDate[cell.dateStr];
                const isToday = cell.dateStr === todayStr;
                const isSelected = cell.dateStr === selectedDate;
                const shiftCount = shiftsByDate[cell.dateStr]?.length || 0;

                return (
                  <button
                    key={cell.dateStr}
                    onClick={() => setSelectedDate(isSelected ? null : cell.dateStr)}
                    className={`
                      aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative transition-all
                      ${isSelected ? "bg-primary text-white ring-2 ring-primary/30" : ""}
                      ${isToday && !isSelected ? "bg-primary/10 text-primary font-bold" : ""}
                      ${!isSelected && !isToday ? "hover:bg-background-secondary text-foreground" : ""}
                    `}
                  >
                    <span>{cell.day}</span>
                    {hasShifts && (
                      <div className="flex gap-0.5 mt-0.5">
                        {Array.from({ length: Math.min(shiftCount, 3) }).map((_, i) => (
                          <span
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-primary"}`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected day detail */}
        {selectedDate && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-3">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>

              {selectedShifts.length === 0 ? (
                <p className="text-sm text-foreground-muted py-2">No shifts scheduled for this day.</p>
              ) : (
                <div className="space-y-3">
                  {selectedShifts.map((shift, idx) => (
                    <div
                      key={`${shift.date}-${idx}`}
                      className="p-3 bg-background-secondary rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          <span className="font-medium text-foreground">
                            {shift.start_time} – {shift.end_time}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {shift.hours.toFixed(1)}h
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-foreground-muted mt-1">
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          {shift.skill_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
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
