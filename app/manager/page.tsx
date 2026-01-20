'use client';

import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button } from '@/components/ui';
import {
  Calendar,
  Users,
  MapPin,
  ClipboardList,
  TrendingUp,
  Briefcase,
} from 'lucide-react';
import Link from 'next/link';

export default function ManagerDashboard() {
  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Manager Dashboard</h1>
        <p className="text-foreground-muted">Overview of your operations</p>
      </div>

      {/* Live Status */}
      <Card className="mb-4 border-warning/30 bg-warning-muted/10">
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-warning rounded-full" />
            <div>
              <p className="font-medium text-foreground">No workers currently clocked in</p>
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
                <p className="text-2xl font-bold text-foreground">0</p>
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
                <p className="text-2xl font-bold text-foreground">0</p>
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
          <div className="text-center py-4">
            <p className="text-foreground-muted">No pending actions</p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/manager/positions">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center py-4">
              <Briefcase className="w-6 h-6 text-info mb-2" />
              <span className="text-sm font-medium text-foreground">
                Positions
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/manager/workers/add">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center py-4">
              <Users className="w-6 h-6 text-accent mb-2" />
              <span className="text-sm font-medium text-foreground">
                Add Worker
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/manager/schedule">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center py-4">
              <Calendar className="w-6 h-6 text-primary mb-2" />
              <span className="text-sm font-medium text-foreground">
                Create Schedule
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/manager/timesheets">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center py-4">
              <ClipboardList className="w-6 h-6 text-success mb-2" />
              <span className="text-sm font-medium text-foreground">
                Timesheets
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/manager/reports">
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
