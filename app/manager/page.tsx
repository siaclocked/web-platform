"use client";

import { useState, useEffect } from "react";
import { PageContainer } from "@/components/layout";
import { Card, CardContent, Button } from "@/components/ui";
import {
  Calendar,
  Users,
  Plus,
  Briefcase,
  MapPin,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface ActiveWorker {
  id: string;
  worker_name: string;
  place_name: string;
  skill_name: string;
  start_time: string;
  duration_minutes: number;
}

export default function ManagerDashboard() {
  const [workerCount, setWorkerCount] = useState(0);
  const [placesCount, setPlacesCount] = useState(0);
  const [activeWorkers, setActiveWorkers] = useState<ActiveWorker[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAllCounts();
  }, []);

  const fetchWorkerCount = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/manager/workers", {
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWorkerCount(data.workers?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching worker count:", error);
    }
  };

  const fetchPlacesCount = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/manager/places", {
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPlacesCount(data.places?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching places count:", error);
    }
  };

  const fetchActiveSessions = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/manager/active-sessions", {
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setActiveWorkers(data.sessions || []);
      }
    } catch (error) {
      console.error("Error fetching active sessions:", error);
    }
  };

  const fetchAllCounts = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchWorkerCount(),
      fetchPlacesCount(),
      fetchActiveSessions(),
    ]);
    setIsLoading(false);
  };

  const formatDurationMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            Manager Dashboard
          </h1>
          <p className="text-foreground-muted">Overview of your operations</p>
        </div>
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Manager Dashboard
        </h1>
        <p className="text-foreground-muted">Overview of your operations</p>
      </div>

      {/* Live Status */}
      <Card
        className={`mb-4 ${activeWorkers.length > 0 ? "border-success/30 bg-success-muted/10" : "border-warning/30 bg-warning-muted/10"}`}
      >
        <CardContent>
          {activeWorkers.length === 0 ? (
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-warning rounded-full" />
              <div>
                <p className="font-medium text-foreground">
                  No workers currently clocked in
                </p>
                <p className="text-sm text-foreground-muted">All locations</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
                <p className="font-medium text-foreground">
                  {activeWorkers.length} worker
                  {activeWorkers.length !== 1 ? "s" : ""} currently clocked in
                </p>
              </div>
              <div className="space-y-2">
                {activeWorkers.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between text-sm bg-background/50 p-2 rounded"
                  >
                    <span className="font-medium text-foreground">
                      {w.worker_name}
                    </span>
                    <div className="flex items-center gap-2 text-foreground-muted">
                      <span>{w.place_name}</span>
                      <span>•</span>
                      <span>{w.skill_name}</span>
                      <span>•</span>
                      <span>{formatDurationMins(w.duration_minutes)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                <p className="text-2xl font-bold text-foreground">
                  {workerCount}
                </p>
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
                <p className="text-2xl font-bold text-foreground">
                  {placesCount}
                </p>
                <p className="text-xs text-foreground-muted">Places</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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

        <Link href="/manager/workers">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center py-4">
              <Users className="w-6 h-6 text-accent mb-2" />
              <span className="text-sm font-medium text-foreground">
                Workers
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/manager/places">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center py-4">
              <MapPin className="w-6 h-6 text-warning mb-2" />
              <span className="text-sm font-medium text-foreground">
                Places
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/manager/schedule">
          <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center py-4">
              <Calendar className="w-6 h-6 text-primary mb-2" />
              <span className="text-sm font-medium text-foreground">
                Schedules
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
