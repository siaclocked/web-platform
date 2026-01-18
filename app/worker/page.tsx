'use client';

import { PageContainer } from '@/components/layout';
import { Card, CardContent, Badge } from '@/components/ui';
import {
  Calendar,
  Clock,
  FileText,
  Play,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

export default function WorkerDashboard() {
  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Good evening!</h1>
        <p className="text-foreground-muted">Here&apos;s your work overview</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link href="/time-tracking">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 bg-success-muted rounded-full flex items-center justify-center mb-3">
                <Play className="w-6 h-6 text-success" />
              </div>
              <span className="font-medium text-foreground">Clock In</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/schedule">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 bg-primary-muted rounded-full flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <span className="font-medium text-foreground">My Schedule</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Today's Shift */}
      <Card className="mb-4">
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">Today&apos;s Shift</h3>
            <Badge variant="default">No shift scheduled</Badge>
          </div>
          <div className="text-center py-4">
            <p className="text-foreground-muted">You have no shifts scheduled for today</p>
          </div>
        </CardContent>
      </Card>

      {/* Hours Summary */}
      <Card className="mb-4">
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">This Week</h3>
            <Link
              href="/profile"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-xs text-foreground-muted">Hours worked</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success">0</p>
              <p className="text-xs text-foreground-muted">Approved</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-warning">0</p>
              <p className="text-xs text-foreground-muted">Pending</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="space-y-2">
        <Link href="/availability">
          <Card className="hover:bg-background-tertiary transition-colors">
            <CardContent className="flex items-center gap-3 py-3">
              <Calendar className="w-5 h-5 text-primary" />
              <span className="flex-1 text-foreground">Set Availability</span>
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/documents">
          <Card className="hover:bg-background-tertiary transition-colors">
            <CardContent className="flex items-center gap-3 py-3">
              <FileText className="w-5 h-5 text-accent" />
              <span className="flex-1 text-foreground">My Documents</span>
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}
