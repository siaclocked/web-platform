'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Badge } from '@/components/ui';
import { BackButton } from '@/components/ui';
import { Clock, DollarSign, TrendingUp, MapPin, Briefcase } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Session {
  id: string;
  start_time: string;
  end_time: string | null;
  place_name: string;
  skill_name: string;
  hours: number | null;
}

interface MonthData {
  label: string;
  hours: number;
  estimated_pay: number;
}

interface HoursData {
  hourly_rate: number;
  current_month: MonthData;
  previous_month: MonthData;
  sessions: Session[];
}

export default function WorkerHoursPage() {
  const router = useRouter();
  const [data, setData] = useState<HoursData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHours();
  }, []);

  const fetchHours = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/worker/hours', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching hours:', error);
    } finally {
      setIsLoading(false);
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
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/worker" label="Back to Dashboard" className="mb-4" />
          <h1 className="text-2xl font-bold text-foreground">My Hours</h1>
          <p className="text-foreground-muted">Track your worked hours and estimated pay</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">
                {data?.current_month.hours.toFixed(1) || '0.0'}h
              </p>
              <p className="text-xs text-foreground-muted">{data?.current_month.label || 'This Month'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="w-6 h-6 text-success mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">
                ${data?.current_month.estimated_pay.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-foreground-muted">Estimated Pay</p>
            </CardContent>
          </Card>
        </div>

        {/* Rate & Previous Month */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-foreground-muted">Hourly Rate</span>
              <span className="font-medium text-foreground">
                {data?.hourly_rate ? `$${data.hourly_rate}/hr` : 'Not set'}
              </span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-foreground-muted">{data?.previous_month.label || 'Last Month'}</span>
              <span className="font-medium text-foreground">
                {data?.previous_month.hours.toFixed(1) || '0.0'}h
                {data?.hourly_rate ? ` ($${data.previous_month.estimated_pay.toFixed(2)})` : ''}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        <h3 className="font-semibold text-foreground mb-3">Recent Sessions</h3>
        {(!data?.sessions || data.sessions.length === 0) ? (
          <Card>
            <CardContent className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
              <h3 className="text-lg font-medium mb-2">No sessions yet</h3>
              <p className="text-foreground-muted">
                Clock in from the Time Tracking page to start logging hours.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.sessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {new Date(session.start_time).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-foreground-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {session.end_time && ` - ${new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {session.place_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          {session.skill_name}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      {session.hours !== null ? (
                        <span className="text-sm font-bold text-foreground">{session.hours.toFixed(1)}h</span>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </div>
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
