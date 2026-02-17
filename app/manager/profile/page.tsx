'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Avatar, Badge } from '@/components/ui';
import { User, Mail, Phone, Building2, Calendar, Users } from 'lucide-react';

interface ManagerProfile {
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
  created_at: string;
}

interface WorkerCount {
  total_workers: number;
}

export default function ManagerProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ManagerProfile | null>(null);
  const [workerCount, setWorkerCount] = useState<WorkerCount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchWorkerCount();
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

  const fetchWorkerCount = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Use API endpoint to get worker count (bypasses RLS)
      const response = await fetch('/api/profile/worker-count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        const data = await response.json();
        setWorkerCount(data);
      } else {
        // Fallback to 0 if API fails
        setWorkerCount({ total_workers: 0 });
      }
    } catch (error) {
      console.error('Error fetching worker count:', error);
      setWorkerCount({ total_workers: 0 });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
                  <Badge variant="info">Manager</Badge>
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
                    <span className="w-4 h-4 text-foreground-muted text-center">$</span>
                    <span>{profile.hourly_rate.toFixed(2)}/hour</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Company
                </label>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-foreground-muted" />
                  <span>{profile.companies?.name}</span>
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

        {/* Manager Stats */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Management Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-background-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-muted rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {workerCount?.total_workers || 0}
                    </p>
                    <p className="text-sm text-foreground-muted">Total Workers</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-background-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">1</p>
                    <p className="text-sm text-foreground-muted">Company</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
