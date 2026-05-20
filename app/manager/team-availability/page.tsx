'use client';

import { useState, useEffect, useMemo } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge, Input } from '@/components/ui';
import { Calendar, ChevronLeft, ChevronRight, Users, Clock, ArrowLeft, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface WorkerItem {
  id: string;
  name: string;
}

interface AvailabilityEntry {
  id: string;
  worker_id: string;
  date: string;
  availability_type: 'available_all_day' | 'available_range' | 'unavailable' | 'vacation';
  start_time?: string | null;
  end_time?: string | null;
  is_paid_leave?: boolean;
}

export default function ManagerWorkerAvailabilityPage() {
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<WorkerItem | null>(null);
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/manager/worker-availability', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setWorkers(data.workers || []);
      }
    } catch (err) {
      console.error('Error fetching workers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWorkerAvailability = async (worker: WorkerItem) => {
    setSelectedWorker(worker);
    setIsLoadingEntries(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `/api/manager/worker-availability?worker_id=${worker.id}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
    } finally {
      setIsLoadingEntries(false);
    }
  };

  // Build availability map by date
  const availabilityMap = useMemo(() => {
    const map: Record<string, AvailabilityEntry> = {};
    entries.forEach(e => { map[e.date] = e; });
    return map;
  }, [entries]);

  // Calendar helpers
  const mYear = currentMonth.getFullYear();
  const mMonth = currentMonth.getMonth();
  const daysInMonth = new Date(mYear, mMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(mYear, mMonth, 1).getDay();
  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayStr = new Date().toISOString().split('T')[0];

  const calendarDays: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];
  const prevMonthDays = new Date(mYear, mMonth, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const pm = mMonth === 0 ? 12 : mMonth;
    const py = mMonth === 0 ? mYear - 1 : mYear;
    calendarDays.push({ day: d, dateStr: `${py}-${String(pm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ day: d, dateStr: `${mYear}-${String(mMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: true });
  }
  const remaining = 7 - (calendarDays.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const nm = mMonth + 2 > 12 ? 1 : mMonth + 2;
      const ny = mMonth + 2 > 12 ? mYear + 1 : mYear;
      calendarDays.push({ day: d, dateStr: `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
    }
  }

  const getAvailabilityColor = (entry?: AvailabilityEntry) => {
    if (!entry) return '';
    switch (entry.availability_type) {
      case 'available_all_day': return 'bg-success/20 border-success/40';
      case 'available_range': return 'bg-warning/20 border-warning/40';
      case 'unavailable': return 'bg-danger/20 border-danger/40';
      case 'vacation': return 'bg-purple-500/20 border-purple-500/40';
      default: return '';
    }
  };

  const getAvailabilityLabel = (entry?: AvailabilityEntry) => {
    if (!entry) return null;
    switch (entry.availability_type) {
      case 'available_all_day': return 'All day';
      case 'available_range':
        return `${entry.start_time?.slice(0, 5) || '?'} – ${entry.end_time?.slice(0, 5) || '?'}`;
      case 'unavailable': return 'Unavailable';
      case 'vacation': return entry.is_paid_leave ? 'Paid Leave' : 'Vacation';
      default: return null;
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

  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto">
        {!selectedWorker ? (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">Worker Availability</h1>
              <p className="text-foreground-muted">Select a worker to view their availability calendar</p>
            </div>

            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search workers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {workers.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
                  <h3 className="text-lg font-medium mb-2">No workers found</h3>
                  <p className="text-foreground-muted">Add workers to your company to see their availability.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {workers.filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase())).map(worker => (
                  <Card
                    key={worker.id}
                    className="cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => fetchWorkerAvailability(worker)}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-muted flex items-center justify-center text-primary font-semibold">
                        {worker.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{worker.name}</h3>
                        <p className="text-xs text-foreground-muted">Click to view availability</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-6">
              <Button variant="outline" size="sm" onClick={() => { setSelectedWorker(null); setEntries([]); }} className="mb-3">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Workers
              </Button>
              <h1 className="text-2xl font-bold text-foreground">{selectedWorker.name}</h1>
              <p className="text-foreground-muted">Availability calendar (read-only)</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge variant="success" className="text-xs">Available all day</Badge>
              <Badge variant="warning" className="text-xs">Available (time range)</Badge>
              <Badge variant="danger" className="text-xs">Unavailable</Badge>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-600">Vacation</span>
              <span className="text-xs text-foreground-muted">No color = no availability set</span>
            </div>

            {isLoadingEntries ? (
              <div className="flex items-center justify-center min-h-[300px]">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(mYear, mMonth - 1, 1))}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="font-semibold text-foreground">{monthLabel}</span>
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
                      const entry = availabilityMap[cell.dateStr];
                      const isToday = cell.dateStr === todayStr;
                      const colorClass = cell.isCurrentMonth ? getAvailabilityColor(entry) : '';
                      const label = cell.isCurrentMonth ? getAvailabilityLabel(entry) : null;

                      return (
                        <div
                          key={idx}
                          className={`relative flex flex-col items-start p-2 min-h-[70px] border border-border/50
                            ${colorClass}
                            ${!cell.isCurrentMonth ? 'text-foreground-muted/40' : 'text-foreground'}`}
                        >
                          <span className={`text-sm font-semibold ${isToday ? 'bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                            {cell.day}
                          </span>
                          {label && (
                            <span className="text-[10px] mt-auto leading-tight text-foreground-muted">
                              {label}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
