'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge, Input } from '@/components/ui';
import { Clock, Users, MapPin, ChevronRight, ChevronDown, ChevronUp, DollarSign, ArrowLeft, Search, AlertTriangle, Check } from 'lucide-react';

interface ActiveSession {
  id: string;
  worker_id: string;
  worker_name: string;
  place_id: string;
  start_time: string;
  is_scheduled: boolean;
  places?: { name: string };
}

interface WorkerPlace {
  id: string;
  name: string;
}

interface Worker {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  hourly_rate?: number;
  places: WorkerPlace[];
}

interface PlaceSummary {
  place_id: string;
  place_name: string;
  total_hours: number;
  estimated_wage: number;
  session_count: number;
  sessions: Array<{
    id: string;
    start_time: string;
    end_time: string;
    hours: number;
    is_scheduled: boolean;
  }>;
}

interface WorkerDetail {
  worker: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    hourly_rate: number;
  };
  places: WorkerPlace[];
  hourly_rate: number;
  place_summaries: PlaceSummary[];
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

type PendingSessionStatus = 'clocked_out' | 'auto_closed' | 'pending_review';

interface PendingSession {
  id: string;
  worker_id: string;
  worker_name: string;
  place_id: string;
  start_time: string;
  end_time: string;
  status: PendingSessionStatus;
  places?: { name: string };
}

export default function ManagerWorkerTrackingPage() {
  const router = useRouter();
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [pendingSessions, setPendingSessions] = useState<PendingSession[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const [searchTerm, setSearchTerm] = useState('');

  // Detail view state
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [workerDetail, setWorkerDetail] = useState<WorkerDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [expandedPlace, setExpandedPlace] = useState<string | null>(null);

  useEffect(() => {
    // Sweep auto-clockout opportunistically so managers see fresh state
    fetch('/api/time-tracking/auto-clockout', { method: 'POST' }).catch(() => {});
    fetchData();
  }, []);

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const [trackingRes, ...pendingResponses] = await Promise.all([
        fetch('/api/manager/worker-tracking', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
        fetch('/api/manager/work-sessions?status=pending_review&limit=50', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
        fetch('/api/manager/work-sessions?status=clocked_out&limit=50', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
        fetch('/api/manager/work-sessions?status=auto_closed&limit=50', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
      ]);

      if (trackingRes.ok) {
        const data = await trackingRes.json();
        setActiveSessions(data.activeSessions || []);
        setWorkers(data.workers || []);
      }

      const pending: PendingSession[] = [];
      for (const res of pendingResponses) {
        if (res.ok) {
          const d = await res.json();
          pending.push(...(d.sessions || []));
        }
      }
      pending.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
      setPendingSessions(pending);
    } catch (error) {
      console.error('Error fetching tracking data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const approveSession = async (id: string) => {
    setApprovingId(id);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/manager/work-sessions/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to approve');
        return;
      }

      setPendingSessions(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Approve error:', err);
      alert('An error occurred');
    } finally {
      setApprovingId(null);
    }
  };

  const fetchWorkerDetail = async (workerId: string) => {
    setIsLoadingDetail(true);
    setSelectedWorker(workerId);
    setExpandedPlace(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/manager/worker-tracking/${workerId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setWorkerDetail(data);
      }
    } catch (error) {
      console.error('Error fetching worker detail:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const goBack = () => {
    setSelectedWorker(null);
    setWorkerDetail(null);
    setExpandedPlace(null);
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

  // Worker detail view
  if (selectedWorker && workerDetail) {
    const totalHours = workerDetail.place_summaries.reduce((sum, ps) => sum + ps.total_hours, 0);
    const totalWage = workerDetail.place_summaries.reduce((sum, ps) => sum + ps.estimated_wage, 0);

    return (
      <PageContainer>
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground mb-3 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Team Tracking
            </button>
            <h1 className="text-2xl font-bold text-foreground">
              {workerDetail.worker.first_name} {workerDetail.worker.last_name}
            </h1>
            <p className="text-foreground-muted">{workerDetail.worker.email}</p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="w-6 h-6 mx-auto mb-1 text-primary" />
                <div className="text-xl font-bold text-foreground">{totalHours.toFixed(1)}h</div>
                <p className="text-xs text-foreground-muted">Total Hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <DollarSign className="w-6 h-6 mx-auto mb-1 text-success" />
                <div className="text-xl font-bold text-foreground">${totalWage.toFixed(2)}</div>
                <p className="text-xs text-foreground-muted">Est. Wage</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <MapPin className="w-6 h-6 mx-auto mb-1 text-accent" />
                <div className="text-xl font-bold text-foreground">{workerDetail.places.length}</div>
                <p className="text-xs text-foreground-muted">Places</p>
              </CardContent>
            </Card>
          </div>

          {workerDetail.hourly_rate > 0 && (
            <p className="text-sm text-foreground-muted mb-4">
              Hourly rate: <span className="font-medium text-foreground">${workerDetail.hourly_rate.toFixed(2)}/hr</span>
            </p>
          )}

          {/* Places breakdown */}
          <h2 className="text-lg font-semibold text-foreground mb-3">Hours by Place</h2>
          {workerDetail.place_summaries.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-foreground-muted">No completed sessions yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {workerDetail.place_summaries.map((ps) => (
                <Card key={ps.place_id}>
                  <CardContent className="p-4">
                    <button
                      onClick={() => setExpandedPlace(expandedPlace === ps.place_id ? null : ps.place_id)}
                      className="w-full flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-foreground-muted" />
                        <div className="text-left">
                          <p className="font-medium text-foreground">{ps.place_name}</p>
                          <p className="text-xs text-foreground-muted">{ps.session_count} sessions</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-foreground">{ps.total_hours.toFixed(1)}h</p>
                          {workerDetail.hourly_rate > 0 && (
                            <p className="text-xs text-success font-medium">${ps.estimated_wage.toFixed(2)}</p>
                          )}
                        </div>
                        {expandedPlace === ps.place_id ? (
                          <ChevronUp className="w-4 h-4 text-foreground-muted" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-foreground-muted" />
                        )}
                      </div>
                    </button>

                    {expandedPlace === ps.place_id && (
                      <div className="mt-4 pt-3 border-t border-border space-y-2">
                        {ps.sessions.map((s) => (
                          <div key={s.id} className="flex items-center justify-between p-2 bg-background-secondary rounded-lg text-sm">
                            <div>
                              <p className="text-foreground font-medium">
                                {new Date(s.start_time).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-foreground-muted">
                                {new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {' - '}
                                {new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-foreground">{s.hours.toFixed(1)}h</p>
                              {s.is_scheduled && (
                                <Badge variant="info" className="text-[10px]">Scheduled</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    );
  }

  // Loading detail view
  if (selectedWorker && isLoadingDetail) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </PageContainer>
    );
  }

  // Main list view
  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Team Tracking</h1>
          <p className="text-foreground-muted">
            Monitor active clock-in sessions and worker hours
          </p>
        </div>

        {/* Sessions awaiting approval */}
        {pendingSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Awaiting Approval ({pendingSessions.length})
            </h2>
            <div className="space-y-2">
              {pendingSessions.map(s => {
                const start = new Date(s.start_time);
                const end = new Date(s.end_time);
                const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                const statusLabel =
                  s.status === 'pending_review' ? 'Edited — needs review'
                  : s.status === 'auto_closed' ? 'Auto-closed'
                  : 'Submitted';
                const statusVariant: 'warning' | 'default' = s.status === 'pending_review' ? 'warning' : 'default';

                return (
                  <Card key={s.id} className={s.status === 'pending_review' ? 'border-l-4 border-l-warning' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground">{s.worker_name}</p>
                            <Badge variant={statusVariant}>{statusLabel}</Badge>
                          </div>
                          <p className="text-xs text-foreground-muted mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {s.places?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-foreground-muted mt-0.5">
                            {start.toLocaleDateString()}
                            {' · '}
                            {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                            {' – '}
                            {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                            {' · '}
                            <span className="font-medium text-foreground">{hours.toFixed(2)}h</span>
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => approveSession(s.id)}
                          isLoading={approvingId === s.id}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Sessions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
            Active Sessions ({activeSessions.length})
          </h2>
          {activeSessions.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <Clock className="w-10 h-10 mx-auto mb-3 text-foreground-muted" />
                <p className="text-foreground-muted">No team members currently clocked in</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {activeSessions.map((session) => {
                const elapsed = now - new Date(session.start_time).getTime();
                return (
                  <Card key={session.id}>
                    <CardContent className="p-4">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => fetchWorkerDetail(session.worker_id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-success/20 rounded-full flex items-center justify-center">
                            <Clock className="w-5 h-5 text-success" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{session.worker_name}</p>
                            <p className="text-sm text-foreground-muted flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {session.places?.name || 'Unknown'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-mono font-bold text-foreground">{formatElapsed(elapsed)}</p>
                            <p className="text-xs text-foreground-muted">
                              Since {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-foreground-muted" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* All Workers */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-foreground-muted" />
            All Team Members ({workers.length})
          </h2>

          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted w-4 h-4" />
              <Input
                type="text"
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {workers.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <Users className="w-10 h-10 mx-auto mb-3 text-foreground-muted" />
                <p className="text-foreground-muted">No team members found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {workers.filter(w => {
                const searchLower = searchTerm.toLowerCase();
                const fullName = `${w.first_name} ${w.last_name}`.toLowerCase();
                return fullName.includes(searchLower) || w.email.toLowerCase().includes(searchLower) || w.places.some(p => p.name.toLowerCase().includes(searchLower));
              }).map((worker) => {
                const isActive = activeSessions.some(s => s.worker_id === worker.id);
                return (
                  <div
                    key={worker.id}
                    className="flex items-center gap-4 px-4 py-3 bg-background border border-border rounded-xl hover:bg-background-secondary/50 transition-colors cursor-pointer"
                    onClick={() => fetchWorkerDetail(worker.id)}
                  >
                    <div className="w-10 h-10 bg-foreground-muted/20 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-foreground">
                        {worker.first_name[0]}{worker.last_name[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {worker.first_name} {worker.last_name}
                        </span>
                        {isActive && (
                          <Badge variant="success" className="text-[10px]">Clocked In</Badge>
                        )}
                      </div>
                      <p className="text-xs text-foreground-muted">
                        {worker.places.map(p => p.name).join(', ') || 'No places assigned'}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-foreground-muted shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
