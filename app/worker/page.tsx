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
        <Link href="/worker/schedule">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 bg-primary-muted rounded-full flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <span className="font-medium text-foreground">My Schedule</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/worker/my-documents">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 bg-accent-muted rounded-full flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-accent" />
              </div>
              <span className="font-medium text-foreground">My Documents</span>
            </CardContent>
          </Card>
        </Link>

        <div className="col-span-2">
          <Link href="/worker/set-availability">
            <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="w-12 h-12 bg-info-muted rounded-full flex items-center justify-center mb-3">
                  <Calendar className="w-6 h-6 text-info" />
                </div>
                <span className="font-medium text-foreground">Set Availability</span>
              </CardContent>
            </Card>
          </Link>
        </div>
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
    </PageContainer>
  );
}
