'use client';

import { PageContainer } from '@/components/layout';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import { useAppStore } from '@/lib/store';
import {
  Bell,
  Calendar,
  Clock,
  FileText,
  MessageSquare,
  Check,
  CheckCheck,
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'schedule' | 'timesheet' | 'document' | 'handoff' | 'general';
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'schedule',
    title: 'Schedule Updated',
    message: 'Your shift on Jan 18 has been changed to 2:00 PM - 10:00 PM',
    createdAt: new Date().toISOString(),
    isRead: false,
  },
  {
    id: '2',
    type: 'handoff',
    title: 'Handoff Note',
    message: 'John D. left a note: "Table 5 needs follow-up on dessert order"',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    isRead: false,
  },
  {
    id: '3',
    type: 'document',
    title: 'New Document',
    message: 'A new document "Safety Training Certificate" has been shared with you',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    isRead: true,
  },
  {
    id: '4',
    type: 'timesheet',
    title: 'Hours Approved',
    message: 'Your hours for January 1-7 have been approved',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    isRead: true,
  },
];

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'schedule':
      return Calendar;
    case 'timesheet':
      return Clock;
    case 'document':
      return FileText;
    case 'handoff':
      return MessageSquare;
    default:
      return Bell;
  }
};

export default function NotificationsPage() {
  const { markNotificationRead } = useAppStore();

  const handleMarkAsRead = (id: string) => {
    markNotificationRead(id);
  };

  const handleMarkAllAsRead = () => {
    mockNotifications.forEach((n) => {
      if (!n.isRead) {
        markNotificationRead(n.id);
      }
    });
  };

  const unreadCount = mockNotifications.filter((n) => !n.isRead).length;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <PageContainer
      title="Notifications"
      action={
        unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
            <CheckCheck className="w-4 h-4 mr-1" />
            Mark all read
          </Button>
        )
      }
    >
      <div className="space-y-2">
        {mockNotifications.map((notification) => {
          const Icon = getNotificationIcon(notification.type);

          return (
            <Card
              key={notification.id}
              className={notification.isRead ? 'opacity-60' : ''}
            >
              <CardContent className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    notification.isRead
                      ? 'bg-background-tertiary'
                      : 'bg-primary-muted'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      notification.isRead ? 'text-foreground-muted' : 'text-primary'
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground">
                      {notification.title}
                    </p>
                    <span className="text-xs text-foreground-muted whitespace-nowrap">
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground-muted mt-1">
                    {notification.message}
                  </p>
                </div>

                {!notification.isRead && (
                  <button
                    onClick={() => handleMarkAsRead(notification.id)}
                    className="p-2 hover:bg-background-tertiary rounded-lg transition-colors shrink-0"
                  >
                    <Check className="w-4 h-4 text-foreground-muted" />
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}

        {mockNotifications.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
              <p className="text-foreground-muted">No notifications yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
