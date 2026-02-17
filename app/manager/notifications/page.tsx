'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { BackButton } from '@/components/ui';
import { Bell, CheckCircle, Clock, Users, AlertCircle, Calendar, XCircle } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata?: any;
}

export default function ManagerNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ notification_id: notificationId }),
      });

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mark_all_read: true }),
      });

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'SCHEDULE_CHANGED_FOR_WORKER':
      case 'schedule_changed':
        return <Clock className="w-5 h-5" />;
      case 'HANDOFF_NOTE_RECEIVED':
      case 'handoff_note':
        return <Users className="w-5 h-5" />;
      case 'OPEN_SHIFT_AVAILABLE':
      case 'OPEN_SHIFT_INTEREST_SUBMITTED':
      case 'open_shift':
        return <AlertCircle className="w-5 h-5" />;
      case 'TIMESHEET_APPROVED':
      case 'TIMESHEET_EDITED_BY_MANAGER':
      case 'timesheet_approved':
        return <CheckCircle className="w-5 h-5" />;
      case 'SCHEDULE_CREATED':
        return <Calendar className="w-5 h-5" />;
      case 'SCHEDULE_INFEASIBLE':
        return <XCircle className="w-5 h-5" />;
      case 'TIMESHEET_PUBLISHED':
        return <Calendar className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'SCHEDULE_CHANGED_FOR_WORKER':
      case 'schedule_changed':
        return 'text-primary';
      case 'HANDOFF_NOTE_RECEIVED':
      case 'handoff_note':
        return 'text-accent';
      case 'OPEN_SHIFT_AVAILABLE':
      case 'OPEN_SHIFT_INTEREST_SUBMITTED':
      case 'open_shift':
        return 'text-warning';
      case 'TIMESHEET_APPROVED':
      case 'TIMESHEET_EDITED_BY_MANAGER':
      case 'timesheet_approved':
        return 'text-success';
      case 'SCHEDULE_CREATED':
        return 'text-success';
      case 'SCHEDULE_INFEASIBLE':
        return 'text-danger';
      case 'TIMESHEET_PUBLISHED':
        return 'text-primary';
      default:
        return 'text-foreground-muted';
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

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
          <BackButton href="/manager" label="Back to Dashboard" className="mb-4" />
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            {unreadCount > 0 && (
              <Button variant="outline" onClick={markAllAsRead}>
                Mark all as read
              </Button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Bell className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
              <h3 className="text-lg font-medium mb-2">No notifications</h3>
              <p className="text-foreground-muted">
                You're all caught up!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <Card 
                key={notification.id} 
                className={`transition-all ${!notification.is_read ? 'border-primary/30 bg-primary-muted/10' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 ${getIconColor(notification.type)}`}>
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-foreground">
                          {notification.title}
                        </h4>
                        {!notification.is_read && (
                          <Badge variant="default" className="shrink-0">
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground-muted mb-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-foreground-muted">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(notification.id)}
                          >
                            Mark as read
                          </Button>
                        )}
                      </div>
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
