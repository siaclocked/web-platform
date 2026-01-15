'use client';

import { useAuthStore } from '@/lib/store';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import {
  Calendar,
  Clock,
  FileText,
  Users,
  MapPin,
  ClipboardList,
  TrendingUp,
  Play,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

function WorkerDashboard() {
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
            <Badge variant="info">Upcoming</Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-muted rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">9:00 AM - 5:00 PM</p>
              <p className="text-sm text-foreground-muted">Downtown Restaurant</p>
            </div>
            <ChevronRight className="w-5 h-5 text-foreground-muted" />
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
              <p className="text-2xl font-bold text-foreground">24</p>
              <p className="text-xs text-foreground-muted">Hours worked</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success">20</p>
              <p className="text-xs text-foreground-muted">Approved</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-warning">4</p>
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
              <Badge variant="warning">1 new</Badge>
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}

function ManagerDashboard() {
  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Manager Dashboard</h1>
        <p className="text-foreground-muted">Overview of your operations</p>
      </div>

      {/* Live Status */}
      <Card className="mb-4 border-success/30 bg-success-muted/10">
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
            <div>
              <p className="font-medium text-foreground">5 Workers Currently Clocked In</p>
              <p className="text-sm text-foreground-muted">All locations</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-muted rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">12</p>
                <p className="text-xs text-foreground-muted">Workers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">3</p>
                <p className="text-xs text-foreground-muted">Places</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Actions */}
      <Card className="mb-4">
        <CardContent>
          <h3 className="font-semibold text-foreground mb-3">Pending Actions</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-warning-muted/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-warning" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  3 timesheet entries need approval
                </p>
              </div>
              <Link href="/timesheets">
                <Button size="sm" variant="secondary">
                  Review
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-3 p-3 bg-primary-muted/20 rounded-lg">
              <Calendar className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Schedule draft ready to publish
                </p>
              </div>
              <Link href="/schedules">
                <Button size="sm" variant="secondary">
                  Publish
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/schedules/create">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center py-4">
              <Calendar className="w-6 h-6 text-primary mb-2" />
              <span className="text-sm font-medium text-foreground">
                Create Schedule
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/workers/add">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center py-4">
              <Users className="w-6 h-6 text-accent mb-2" />
              <span className="text-sm font-medium text-foreground">
                Add Worker
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/timesheets">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center py-4">
              <ClipboardList className="w-6 h-6 text-success mb-2" />
              <span className="text-sm font-medium text-foreground">
                Timesheets
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/reports">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center py-4">
              <TrendingUp className="w-6 h-6 text-warning mb-2" />
              <span className="text-sm font-medium text-foreground">
                Reports
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}

function AdminDashboard() {
  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Company Admin</h1>
        <p className="text-foreground-muted">Manage your organization</p>
      </div>

      <div className="grid gap-4">
        <Link href="/company">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-12 h-12 bg-primary-muted rounded-lg flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Company Settings</p>
                <p className="text-sm text-foreground-muted">
                  Configure company details and settings
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/managers">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Managers</p>
                <p className="text-sm text-foreground-muted">
                  Add and manage manager accounts
                </p>
              </div>
              <Badge>3</Badge>
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}

export default function DashboardPage() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-foreground-muted">Please log in to continue</p>
            <Link href="/login">
              <Button className="mt-4">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'manager':
      return <ManagerDashboard />;
    default:
      return <WorkerDashboard />;
  }
}
