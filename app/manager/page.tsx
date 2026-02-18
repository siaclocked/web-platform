"use client";

import { useState, useEffect } from "react";
import { PageContainer } from "@/components/layout";
import { Card, CardContent } from "@/components/ui";
import {} from "lucide-react";
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
      {/* Stat cards — 4-column row matching wireframe */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <span className="text-3xl font-bold text-foreground">{activeWorkers.length}</span>
            <span className="text-sm text-foreground-muted mt-1">Active Workers</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <span className="text-3xl font-bold text-foreground">{workerCount}</span>
            <span className="text-sm text-foreground-muted mt-1">Total Employees</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <span className="text-3xl font-bold text-foreground">{placesCount}</span>
            <span className="text-sm text-foreground-muted mt-1">Places</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <span className="text-3xl font-bold text-foreground">0</span>
            <span className="text-sm text-foreground-muted mt-1">Open Shifts</span>
          </CardContent>
        </Card>
      </div>

    </PageContainer>
  );
}
