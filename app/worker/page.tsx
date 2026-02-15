"use client";

import { PageContainer } from "@/components/layout";
import { Card, CardContent } from "@/components/ui";
import { Calendar, Clock, Play, Bell, DollarSign, User } from "lucide-react";
import Link from "next/link";

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

        <Link href="/worker/set-availability">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 bg-info-muted rounded-full flex items-center justify-center mb-3">
                <Clock className="w-6 h-6 text-info" />
              </div>
              <span className="font-medium text-foreground">
                Set Availability
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/worker/time-tracking">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 bg-success-muted rounded-full flex items-center justify-center mb-3">
                <Play className="w-6 h-6 text-success" />
              </div>
              <span className="font-medium text-foreground">Time Tracking</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/worker/hours">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 bg-warning-muted rounded-full flex items-center justify-center mb-3">
                <DollarSign className="w-6 h-6 text-warning" />
              </div>
              <span className="font-medium text-foreground">My Hours</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/worker/notifications">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mb-3">
                <Bell className="w-6 h-6 text-accent" />
              </div>
              <span className="font-medium text-foreground">Notifications</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/worker/profile">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 bg-foreground/10 rounded-full flex items-center justify-center mb-3">
                <User className="w-6 h-6 text-foreground" />
              </div>
              <span className="font-medium text-foreground">My Profile</span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}
