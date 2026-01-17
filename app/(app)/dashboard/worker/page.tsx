'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import {
  Calendar,
  Clock,
  FileText,
  DollarSign,
  Play,
  Bell,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  User,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import type { User as UserType, Shift, Notification, Document } from '@/lib/types/database';

export default function WorkerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserType | null>(null);
  const [todayShift, setTodayShift] = useState<Shift | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [weekHours, setWeekHours] = useState(0);
  const [monthlyPay, setMonthlyPay] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const supabase = createClient();
      
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (userError) throw userError;
      setUser(userData);

      // Get today's shift
      const today = new Date().toISOString().split('T')[0];
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('*')
        .eq('worker_id', authUser.id)
        .gte('start_time', today)
        .lt('start_time', new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000).toISOString())
        .order('start_time')
        .limit(1);

      if (shiftsError) throw shiftsError;
      setTodayShift(shiftsData?.[0] || null);

      // Get unread notifications
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (notificationsError) throw notificationsError;
      setNotifications(notificationsData || []);

      // Get recent documents
      const { data: documentsData, error: documentsError } = await supabase
        .from('documents')
        .select('*')
        .eq('worker_id', authUser.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(3);

      if (documentsError) throw documentsError;
      setDocuments(documentsData || []);

      // Calculate week hours and monthly pay (mock data for now)
      setWeekHours(24);
      setMonthlyPay(userData.hourly_rate ? userData.hourly_rate * 160 : 0);

    } catch (err) {
      console.error('Error fetching worker data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockIn = () => {
    router.push('/dashboard/worker/time-tracking');
  };

  const handleViewSchedule = () => {
    router.push('/dashboard/worker/schedule');
  };

  const handleRequestScheduleChange = () => {
    router.push('/dashboard/worker/schedule/request');
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
            <p className="text-foreground-muted mb-4">{error}</p>
            <Button onClick={fetchData}>Try Again</Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.first_name}!
        </h1>
        <p className="text-foreground-muted">Here's your work overview</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Button
          onClick={handleClockIn}
          className="h-auto py-4 flex-col gap-2"
        >
          <Play className="w-6 h-6" />
          <span className="text-sm">Clock In</span>
        </Button>

        <Button
          onClick={handleViewSchedule}
          variant="secondary"
          className="h-auto py-4 flex-col gap-2"
        >
          <Calendar className="w-6 h-6" />
          <span className="text-sm">My Schedule</span>
        </Button>
      </div>

      {/* Today's Shift */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">Today's Shift</h3>
            <Badge variant={todayShift ? 'info' : 'default'}>
              {todayShift ? 'Upcoming' : 'No Shift'}
            </Badge>
          </div>
          {todayShift ? (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-muted rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {new Date(todayShift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                  {new Date(todayShift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-sm text-foreground-muted">Scheduled shift</p>
              </div>
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-foreground-muted">No shift scheduled for today</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewSchedule}
                className="mt-2"
              >
                View Open Shifts
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hours & Pay Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-muted rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{weekHours}</p>
                <p className="text-xs text-foreground-muted">Hours this week</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success-muted rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">${monthlyPay.toFixed(2)}</p>
                <p className="text-xs text-foreground-muted">Expected monthly pay</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <Card className="mb-6">
          <CardContent className="py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Notifications</h3>
              <Link href="/dashboard/worker/notifications">
                <Button variant="ghost" size="sm">
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {notifications.slice(0, 3).map((notification) => (
                <div key={notification.id} className="flex items-start gap-3 p-3 bg-background-secondary rounded-lg">
                  <Bell className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{notification.title}</p>
                    <p className="text-xs text-foreground-muted">{notification.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="space-y-3 mb-6">
        <Link href="/dashboard/worker/schedule">
          <Card className="hover:bg-background-secondary transition-colors">
            <CardContent className="flex items-center gap-3 py-3">
              <Calendar className="w-5 h-5 text-primary" />
              <span className="flex-1 text-foreground">View Full Schedule</span>
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </CardContent>
          </Card>
        </Link>

        <button
          onClick={handleRequestScheduleChange}
          className="w-full"
        >
          <Card className="hover:bg-background-secondary transition-colors text-left">
            <CardContent className="flex items-center gap-3 py-3">
              <MessageSquare className="w-5 h-5 text-accent" />
              <span className="flex-1 text-foreground">Request Schedule Change</span>
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </CardContent>
          </Card>
        </button>

        <Link href="/dashboard/worker/documents">
          <Card className="hover:bg-background-secondary transition-colors">
            <CardContent className="flex items-center gap-3 py-3">
              <FileText className="w-5 h-5 text-warning" />
              <span className="flex-1 text-foreground">My Documents</span>
              {documents.length > 0 && (
                <Badge variant="warning">{documents.length}</Badge>
              )}
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/worker/notifications">
          <Card className="hover:bg-background-secondary transition-colors">
            <CardContent className="flex items-center gap-3 py-3">
              <Bell className="w-5 h-5 text-info" />
              <span className="flex-1 text-foreground">Notifications</span>
              {notifications.length > 0 && (
                <Badge variant="danger">{notifications.length}</Badge>
              )}
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Documents */}
      {documents.length > 0 && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Recent Documents</h3>
              <Link href="/dashboard/worker/documents">
                <Button variant="ghost" size="sm">
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-2">
                  <FileText className="w-4 h-4 text-foreground-muted" />
                  <span className="flex-1 text-sm text-foreground">{doc.name}</span>
                  <span className="text-xs text-foreground-muted">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
