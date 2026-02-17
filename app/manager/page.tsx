"use client";

import { useState, useEffect } from "react";
import { PageContainer } from "@/components/layout";
import { Card, CardContent } from "@/components/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ActiveWorker {
  id: string;
  worker_name: string;
  place_name: string;
  skill_name: string;
  start_time: string;
  duration_minutes: number;
}

export default function ManagerDashboard() {
  const [workerCount, setWorkerCount] = useState(0);
  const [placesCount, setPlacesCount] = useState(0);
  const [activeWorkers, setActiveWorkers] = useState<ActiveWorker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    fetchAllCounts();
  }, []);

  const fetchWorkerCount = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/manager/workers", {
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWorkerCount(data.workers?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching worker count:", error);
    }
  };

  const fetchPlacesCount = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/manager/places", {
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPlacesCount(data.places?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching places count:", error);
    }
  };

  const fetchActiveSessions = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/manager/active-sessions", {
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setActiveWorkers(data.sessions || []);
      }
    } catch (error) {
      console.error("Error fetching active sessions:", error);
    }
  };

  const fetchAllCounts = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchWorkerCount(),
      fetchPlacesCount(),
      fetchActiveSessions(),
    ]);
    setIsLoading(false);
  };

  // Calendar helpers
  const mYear = currentMonth.getFullYear();
  const mMonth = currentMonth.getMonth();
  const daysInMonth = new Date(mYear, mMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(mYear, mMonth, 1).getDay();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const calendarCells: Array<{ day: number; dateStr: string; isCurrentMonth: boolean } | null> = [];
  // Previous month filler
  const prevMonthDays = new Date(mYear, mMonth, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const pm = mMonth === 0 ? 12 : mMonth;
    const py = mMonth === 0 ? mYear - 1 : mYear;
    calendarCells.push({ day: d, dateStr: `${py}-${String(pm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${mYear}-${String(mMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({ day: d, dateStr, isCurrentMonth: true });
  }
  // Next month filler
  const remaining = 7 - (calendarCells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const nm = mMonth + 2 > 12 ? 1 : mMonth + 2;
      const ny = mMonth + 2 > 12 ? mYear + 1 : mYear;
      calendarCells.push({ day: d, dateStr: `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
    }
  }

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
      {/* Stat cards — 4-column row matching wireframe */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <span className="text-3xl font-bold text-foreground">{activeWorkers.length}</span>
            <span className="text-sm text-foreground-muted mt-1">Active Workers</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <span className="text-3xl font-bold text-foreground">{workerCount}</span>
            <span className="text-sm text-foreground-muted mt-1">Total Employees</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <span className="text-3xl font-bold text-foreground">{placesCount}</span>
            <span className="text-sm text-foreground-muted mt-1">Places</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <span className="text-3xl font-bold text-foreground">0</span>
            <span className="text-sm text-foreground-muted mt-1">Open Shifts</span>
          </CardContent>
        </Card>
      </div>

      {/* Calendar — month mini-view matching wireframe */}
      <Card>
        <CardContent className="p-6">
          {/* Month nav */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setCurrentMonth(new Date(mYear, mMonth - 1, 1))}
              className="p-1 rounded hover:bg-background-secondary transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-foreground-muted" />
            </button>
            <div className="flex items-center gap-3">
              <select
                value={mMonth}
                onChange={(e) => setCurrentMonth(new Date(mYear, Number(e.target.value), 1))}
                className="text-sm font-medium py-1.5 px-3 border border-border rounded-lg bg-background text-foreground"
              >
                {monthNames.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
              <select
                value={mYear}
                onChange={(e) => setCurrentMonth(new Date(Number(e.target.value), mMonth, 1))}
                className="text-sm font-medium py-1.5 px-3 border border-border rounded-lg bg-background text-foreground"
              >
                {Array.from({ length: 5 }, (_, i) => mYear - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setCurrentMonth(new Date(mYear, mMonth + 1, 1))}
              className="p-1 rounded hover:bg-background-secondary transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-foreground-muted py-2">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarCells.map((cell, idx) => {
              if (!cell) return <div key={idx} />;
              const isToday = cell.dateStr === todayStr;
              return (
                <div
                  key={idx}
                  className={`relative flex items-start justify-start p-2 min-h-[60px] border border-border/50 
                    ${cell.isCurrentMonth ? 'text-foreground' : 'text-foreground-muted/40'}
                    ${isToday ? 'bg-primary/5' : ''}`}
                >
                  <span className={`text-sm font-medium ${isToday ? 'bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                    {cell.day}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
