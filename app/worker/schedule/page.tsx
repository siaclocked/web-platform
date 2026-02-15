"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout";
import { Card, CardContent, Badge } from "@/components/ui";
import { BackButton } from "@/components/ui";
import {
  Calendar,
  Clock,
  MapPin,
  Briefcase,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Assignment {
  date: string;
  day_name: string;
  start_time: string;
  end_time: string;
  skill_id: string;
  skill_name: string;
  hours: number;
}

interface Schedule {
  id: string;
  name: string;
  place_name: string;
  start_date: string;
  end_date: string;
  assignments: Assignment[];
  total_hours: number;
}

export default function WorkerSchedulePage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/worker/schedule", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules || []);
        // Auto-expand the first schedule
        if (data.schedules && data.schedules.length > 0) {
          setExpandedSchedules(new Set([data.schedules[0].id]));
        }
      }
    } catch (error) {
      console.error("Error fetching schedules:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedSchedules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
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
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton
            href="/worker"
            label="Back to Dashboard"
            className="mb-4"
          />
          <h1 className="text-2xl font-bold text-foreground">My Schedule</h1>
          <p className="text-foreground-muted">
            Your assigned shifts from generated schedules
          </p>
        </div>

        {schedules.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No shifts scheduled</h3>
              <p className="text-muted-foreground">
                You don&apos;t have any shifts assigned yet. Check back after
                your manager generates a schedule.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {schedules.map((schedule) => {
              const isExpanded = expandedSchedules.has(schedule.id);

              return (
                <Card key={schedule.id}>
                  <div
                    className="p-4 cursor-pointer hover:bg-background-secondary transition-colors"
                    onClick={() => toggleExpand(schedule.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">
                          {schedule.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-foreground-muted">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{schedule.place_name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              {formatDate(schedule.start_date)} -{" "}
                              {formatDate(schedule.end_date)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="info">
                            {schedule.assignments.length} shift
                            {schedule.assignments.length !== 1 ? "s" : ""}
                          </Badge>
                          <span className="text-sm text-foreground-muted">
                            {schedule.total_hours.toFixed(1)}h total
                          </span>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-foreground-muted" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-foreground-muted" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border">
                      {schedule.assignments.map((assignment, idx) => (
                        <div
                          key={`${assignment.date}-${idx}`}
                          className="p-4 border-b border-border last:border-b-0 hover:bg-background-secondary"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-foreground">
                                {assignment.day_name},{" "}
                                {formatDate(assignment.date)}
                              </h4>
                              <div className="flex items-center gap-4 mt-1 text-sm">
                                <div className="flex items-center gap-1 text-foreground-muted">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>
                                    {assignment.start_time} -{" "}
                                    {assignment.end_time}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Briefcase className="w-3.5 h-3.5 text-foreground-muted" />
                                  <Badge variant="default" className="text-xs">
                                    {assignment.skill_name}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {assignment.hours.toFixed(1)}h
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
