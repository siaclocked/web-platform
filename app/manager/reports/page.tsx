"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout";
import { Card, CardContent, Button, Badge } from "@/components/ui";
import { BackButton } from "@/components/ui";
import { TrendingUp, Clock, Users, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface WorkerHours {
  id: string;
  worker_name: string;
  worker_id: string;
  total_hours: number;
  approved_hours: number;
  period: string;
  status: string;
}

type PeriodFilter = "current" | "previous" | "all";

export default function ManagerReportsPage() {
  const router = useRouter();
  const [workerHours, setWorkerHours] = useState<WorkerHours[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>("current");

  useEffect(() => {
    fetchHours();
  }, [period]);

  const fetchHours = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId: user.id, period }),
      });

      if (response.ok) {
        const data = await response.json();
        setWorkerHours(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching hours:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalHours = workerHours.reduce((sum, w) => sum + w.total_hours, 0);

  const getPeriodLabel = () => {
    const now = new Date();
    if (period === "current") {
      return now.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    } else if (period === "previous") {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1);
      return prev.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
    return "All Time";
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton
            href="/manager"
            label="Back to Dashboard"
            className="mb-4"
          />
          <h1 className="text-2xl font-bold text-foreground">
            Hours & Reports
          </h1>
          <p className="text-foreground-muted">
            Review worked hours by employee
          </p>
        </div>

        {/* Period Filter */}
        <div className="flex gap-2 mb-6">
          {(["current", "previous", "all"] as PeriodFilter[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "primary" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p === "current"
                ? "This Month"
                : p === "previous"
                  ? "Last Month"
                  : "All Time"}
            </Button>
          ))}
        </div>

        {/* Summary Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="flex items-center justify-center mb-2">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {workerHours.length}
                </p>
                <p className="text-xs text-foreground-muted">
                  Workers with hours
                </p>
              </div>
              <div>
                <div className="flex items-center justify-center mb-2">
                  <Clock className="w-5 h-5 text-accent" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {totalHours.toFixed(1)}
                </p>
                <p className="text-xs text-foreground-muted">Total hours</p>
              </div>
              <div>
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {getPeriodLabel()}
                </p>
                <p className="text-xs text-foreground-muted">Period</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Worker Hours List */}
        {workerHours.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
              <h3 className="text-lg font-medium mb-2">No hours recorded</h3>
              <p className="text-foreground-muted">
                No workers have logged hours for this period yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {workerHours
              .sort((a, b) => b.total_hours - a.total_hours)
              .map((worker) => (
                <Card key={worker.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {worker.worker_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">
                            {worker.worker_name}
                          </h4>
                          <p className="text-xs text-foreground-muted">
                            {worker.period}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">
                          {worker.total_hours.toFixed(1)}h
                        </p>
                        <Badge variant="warning" className="text-xs">
                          Pending
                        </Badge>
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
