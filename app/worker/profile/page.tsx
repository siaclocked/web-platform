'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Avatar, Badge } from '@/components/ui';
import { BackButton } from '@/components/ui';
import { User, Mail, Phone, Clock, Calendar, MapPin, Briefcase } from 'lucide-react';

interface Position {
  id: string;
  name: string;
  color: string;
}

interface Place {
  id: string;
  name: string;
  address?: string;
}

interface WorkerProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;
  avatar_url?: string;
  hourly_rate?: number;
  companies: {
    id: string;
    name: string;
  };
  positions: Position[];
  places: Place[];
  created_at: string;
}

interface WorkSession {
  id: string;
  start_time: string;
  end_time?: string;
  place: {
    name: string;
  };
  total_hours?: number;
}

export default function WorkerProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [recentSessions, setRecentSessions] = useState<WorkSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchRecentSessions();
  }, []);

  const fetchProfile = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Use API endpoint to bypass RLS recursion
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const profile = await response.json();
      setProfile(profile);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentSessions = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Use API endpoint to get work sessions (bypasses RLS)
      const response = await fetch('/api/profile/work-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        const sessions = await response.json();
        setRecentSessions(sessions || []);
      } else {
        // Fallback to empty array if API fails
        setRecentSessions([]);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setRecentSessions([]);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateHours = (startTime: string, endTime?: string) => {
    if (!endTime) return 'In progress';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return hours.toFixed(1);
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </PageContainer>
    );
  }

  if (!profile) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-foreground-muted">Profile not found</p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <BackButton href="/worker" />
        </div>

        {/* Profile Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <Avatar
                src={profile.avatar_url}
                name={`${profile.first_name} ${profile.last_name}`}
                size="xl"
              />
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-foreground mb-1">
                  {profile.first_name} {profile.last_name}
                </h1>
                <p className="text-foreground-muted mb-2">{profile.email}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="info">Worker</Badge>
                  <span className="text-sm text-foreground-muted">
                    at {profile.companies?.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    First Name
                  </label>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-foreground-muted" />
                    <span>{profile.first_name}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Last Name
                  </label>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-foreground-muted" />
                    <span>{profile.last_name}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email
                </label>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-foreground-muted" />
                  <span>{profile.email}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Phone
                </label>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-foreground-muted" />
                  <span>{profile.phone || 'Not provided'}</span>
                </div>
              </div>

              {profile.hourly_rate && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Hourly Rate
                  </label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-foreground-muted" />
                    <span>${profile.hourly_rate}/hour</span>
                  </div>
                </div>
              )}

              {/* Positions/Skills */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Positions
                </label>
                <div className="flex items-start gap-2">
                  <Briefcase className="w-4 h-4 text-foreground-muted mt-1" />
                  {profile.positions && profile.positions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.positions.map((pos) => (
                        <span
                          key={pos.id}
                          className="px-2 py-1 text-sm rounded-md text-white"
                          style={{ backgroundColor: pos.color || '#3b82f6' }}
                        >
                          {pos.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-foreground-muted">No positions assigned</span>
                  )}
                </div>
              </div>

              {/* Work Locations */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Work Locations
                </label>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-foreground-muted mt-1" />
                  {profile.places && profile.places.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.places.map((place) => (
                        <span
                          key={place.id}
                          className="px-2 py-1 text-sm bg-info/20 text-info rounded-md"
                        >
                          {place.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-foreground-muted">No locations assigned</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Member Since
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-foreground-muted" />
                  <span>{formatDate(profile.created_at)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Work Sessions */}
        {recentSessions.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Recent Work Sessions
              </h2>
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 bg-background-secondary rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {session.place?.name || 'Unknown Location'}
                      </p>
                      <p className="text-sm text-foreground-muted">
                        {formatDate(session.start_time)} • {formatTime(session.start_time)}
                        {session.end_time && ` - ${formatTime(session.end_time)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">
                        {calculateHours(session.start_time, session.end_time)}h
                      </p>
                      {!session.end_time && (
                        <Badge variant="success">Active</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
