"use client";

import { useState, useEffect } from "react";
import { PageContainer } from "@/components/layout";
import { Card, CardContent } from "@/components/ui";
import { Calendar, Clock, DollarSign, MapPin, Briefcase } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface NextShift {
  date: string;
  day_name: string;
  start_time: string;
  end_time: string;
  skill_name: string;
  place_name: string;
  schedule_name: string;
  hours: number;
  is_today: boolean;
  is_active: boolean;
}

interface HoursData {
  current_month: {
    label: string;
    hours: number;
    estimated_pay: number;
  };
  hourly_rate: number;
}

export default function WorkerDashboard() {
  const [nextShift, setNextShift] = useState<NextShift | null>(null);
  const [hoursData, setHoursData] = useState<HoursData | null>(null);
  const [isLoadingShift, setIsLoadingShift] = useState(true);
  const [isLoadingHours, setIsLoadingHours] = useState(true);

  useEffect(() => {
    fetchNextShift();
    fetchHours();
  }, []);

  const fetchNextShift = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch("/api/worker/next-shift", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setNextShift(data.next_shift);
      }
    } catch (error) {
      console.error("Error fetching next shift:", error);
    } finally {
      setIsLoadingShift(false);
    }
  };

  const fetchHours = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch("/api/worker/hours", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setHoursData(data);
      }
    } catch (error) {
      console.error("Error fetching hours:", error);
    } finally {
      setIsLoadingHours(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning!";
    if (hour < 17) return "Good afternoon!";
    return "Good evening!";
  };

  const formatShiftDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{getGreeting()}</h1>
        <p className="text-foreground-muted">Here&apos;s your work overview</p>
      </div>

      {/* Next Shift Card */}
      {isLoadingShift ? (
        <Card className="mb-4">
          <CardContent className="py-4">
            <div className="animate-pulse flex items-center gap-3">
              <div className="w-12 h-12 bg-foreground/10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-foreground/10 rounded w-2/3" />
                <div className="h-3 bg-foreground/10 rounded w-1/2" />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : nextShift ? (
        <Link href="/team-member/schedule">
          <Card className={`mb-4 border-l-4 ${nextShift.is_active ? "border-l-success bg-success-muted/10" : nextShift.is_today ? "border-l-primary bg-primary-muted/10" : "border-l-accent"}`}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${nextShift.is_active ? "bg-success/20" : nextShift.is_today ? "bg-primary/20" : "bg-accent/20"}`}>
                    <Clock className={`w-6 h-6 ${nextShift.is_active ? "text-success" : nextShift.is_today ? "text-primary" : "text-accent"}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">
                        {nextShift.is_active ? "Current Shift" : nextShift.is_today ? "Today" : `${nextShift.day_name}, ${formatShiftDate(nextShift.date)}`}
                      </p>
                      {nextShift.is_active && (
                        <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                      )}
                    </div>
                    <p className="text-sm text-foreground-muted">
                      {nextShift.start_time} – {nextShift.end_time} · {nextShift.hours}h
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-foreground-muted">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {nextShift.place_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {nextShift.skill_name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ) : (
        <Card className="mb-4 border-l-4 border-l-foreground/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-foreground/10 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-foreground-muted" />
              </div>
              <div>
                <p className="font-medium text-foreground">No upcoming shifts</p>
                <p className="text-sm text-foreground-muted">Check your schedule or set your availability</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hours Worked & Expected Wage */}
      {isLoadingHours ? (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="py-6">
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-foreground/10 rounded w-1/2 mx-auto" />
                <div className="h-3 bg-foreground/10 rounded w-2/3 mx-auto" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6">
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-foreground/10 rounded w-1/2 mx-auto" />
                <div className="h-3 bg-foreground/10 rounded w-2/3 mx-auto" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : hoursData ? (
        <div className="grid grid-cols-2 gap-3">
          <Link href="/team-member/hours">
            <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="w-10 h-10 bg-primary-muted rounded-full flex items-center justify-center mb-2">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <span className="text-2xl font-bold text-foreground">{hoursData.current_month.hours}h</span>
                <span className="text-xs text-foreground-muted mt-1">Hours worked</span>
                <span className="text-[10px] text-foreground-muted">{hoursData.current_month.label}</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/team-member/hours">
            <Card className="hover:bg-background-tertiary transition-colors cursor-pointer">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="w-10 h-10 bg-success-muted rounded-full flex items-center justify-center mb-2">
                  <DollarSign className="w-5 h-5 text-success" />
                </div>
                <span className="text-2xl font-bold text-foreground">
                  ${hoursData.current_month.estimated_pay.toFixed(2)}
                </span>
                <span className="text-xs text-foreground-muted mt-1">Expected wage</span>
                <span className="text-[10px] text-foreground-muted">
                  {hoursData.hourly_rate > 0 ? `$${hoursData.hourly_rate}/hr` : "Rate not set"}
                </span>
              </CardContent>
            </Card>
          </Link>
        </div>
      ) : null}
    </PageContainer>
  );
}
