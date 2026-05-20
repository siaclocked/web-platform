"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout";
import { Card, CardContent, Button, Input, Badge } from "@/components/ui";
import {
  Play,
  Square,
  Clock,
  MapPin,
  MessageSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ActiveSession {
  id: string;
  place_id: string;
  skill_id: string;
  start_time: string;
  is_scheduled: boolean;
  places?: { name: string };
  skills?: { name: string };
}

interface Place {
  id: string;
  name: string;
}

interface RecentSession {
  id: string;
  start_time: string;
  end_time: string;
  place?: { name: string };
  places?: { name: string };
  skills?: { name: string };
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export default function WorkerClockInPage() {
  const router = useRouter();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(
    null,
  );
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState("");
  const [sessionDuration, setSessionDuration] = useState(0);
  const [handoffNote, setHandoffNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isClocking, setIsClocking] = useState(false);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activeSession) {
      const interval = setInterval(() => {
        setSessionDuration(
          Date.now() - new Date(activeSession.start_time).getTime(),
        );
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeSession]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      // Fetch active session + places, and recent sessions in parallel
      const [activeRes, recentRes] = await Promise.all([
        fetch("/api/time-tracking", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch("/api/profile/work-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id }),
        }),
      ]);

      if (activeRes.ok) {
        const data = await activeRes.json();
        if (data.active_session) {
          setActiveSession(data.active_session);
        }
        if (data.places) {
          setPlaces(data.places);
        }
      }

      if (recentRes.ok) {
        const sessions = await recentRes.json();
        setRecentSessions(Array.isArray(sessions) ? sessions.slice(0, 5) : []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockIn = async () => {
    if (!selectedPlace) {
      alert("Please select a place");
      return;
    }

    setIsClocking(true);
    try {
      const response = await fetch("/api/time-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          place_id: selectedPlace,
        }),
      });

      if (response.ok) {
        await fetchInitialData();
        setSelectedPlace("");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to clock in");
      }
    } catch (error) {
      console.error("Clock in error:", error);
      alert("An error occurred while clocking in");
    } finally {
      setIsClocking(false);
    }
  };

  const handleClockOut = async () => {
    setIsClocking(true);
    try {
      const response = await fetch("/api/time-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stop",
          handoff_note: handoffNote.trim() || null,
          handoff_audience: handoffNote.trim() ? "NEXT_AT_PLACE" : null,
        }),
      });

      if (response.ok) {
        setActiveSession(null);
        setHandoffNote("");
        setSessionDuration(0);
        await fetchInitialData();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to clock out");
      }
    } catch (error) {
      console.error("Clock out error:", error);
      alert("An error occurred while clocking out");
    } finally {
      setIsClocking(false);
    }
  };

  const formatSessionDuration = (start: string, end: string) => {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const totalMinutes = Math.round(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
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

  if (activeSession) {
    return (
      <PageContainer>
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">
              Currently Working
            </h1>
            <p className="text-foreground-muted">
              {activeSession.places?.name || "Unknown Place"}
            </p>
          </div>

          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-foreground mb-2 font-mono">
                  {formatElapsed(sessionDuration)}
                </div>
                <p className="text-foreground-muted">
                  Started at{" "}
                  {new Date(activeSession.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                </p>
                {activeSession.is_scheduled && (
                  <Badge variant="success" className="mt-2">
                    Scheduled Shift
                  </Badge>
                )}
              </div>

              <div className="mb-6">
                <h3 className="font-medium text-foreground mb-3 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Handoff Note (Optional)
                </h3>
                <Input
                  placeholder="Add notes for the next shift..."
                  value={handoffNote}
                  onChange={(e) => setHandoffNote(e.target.value)}
                />
              </div>

              <Button
                onClick={handleClockOut}
                isLoading={isClocking}
                className="w-full"
                variant="danger"
              >
                <Square className="w-4 h-4 mr-2" />
                Clock Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Clock In</h1>
          <p className="text-foreground-muted">
            Select your work location and start your shift
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Place
                </label>
                <select
                  value={selectedPlace}
                  onChange={(e) => setSelectedPlace(e.target.value)}
                  className="w-full p-2 border border-border rounded-lg bg-background text-foreground"
                >
                  <option value="">Select a place</option>
                  {places.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name}
                    </option>
                  ))}
                </select>
                {places.length === 0 && (
                  <p className="text-xs text-foreground-muted mt-1">
                    No places assigned. Contact your manager.
                  </p>
                )}
              </div>

              <Button
                onClick={handleClockIn}
                isLoading={isClocking}
                disabled={!selectedPlace}
                className="w-full"
              >
                <Play className="w-4 h-4 mr-2" />
                Clock In
              </Button>
            </div>
          </CardContent>
        </Card>

        {recentSessions.length > 0 && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="font-medium text-foreground mb-4">
                Session History
              </h3>
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 bg-background-secondary rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {session.place?.name || session.places?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {new Date(session.start_time).toLocaleDateString()} •{" "}
                        {new Date(session.start_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                        {session.end_time &&
                          ` \u2013 ${new Date(session.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`}
                      </p>
                    </div>
                    <div className="text-right">
                      {session.end_time ? (
                        <span className="text-sm font-medium text-foreground">
                          {formatSessionDuration(
                            session.start_time,
                            session.end_time,
                          )}
                        </span>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {recentSessions.length === 0 && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="font-medium text-foreground mb-4">
                Session History
              </h3>
              <p className="text-foreground-muted text-center py-4">
                No sessions yet
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
