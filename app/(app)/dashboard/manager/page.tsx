'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import {
  Users,
  Calendar,
  MapPin,
  Clock,
  Plus,
  Play,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  FileText,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import type { User, Place, Schedule } from '@/lib/types/database';

export default function ManagerDashboard() {
  const router = useRouter();
  const [managers, setManagers] = useState<User[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const supabase = createClient();
      
      // Get current user and company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      // Get places for this company
      const { data: placesData, error: placesError } = await supabase
        .from('places')
        .select('*')
        .eq('company_id', userData.company_id)
        .eq('is_active', true);

      if (placesError) throw placesError;

      // Get workers for this company
      const { data: workersData, error: workersError } = await supabase
        .from('users')
        .select('*')
        .eq('company_id', userData.company_id)
        .eq('role', 'worker')
        .eq('is_active', true);

      if (workersError) throw workersError;

      // Get recent schedules
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (schedulesError) throw schedulesError;

      setPlaces(placesData || []);
      setManagers(workersData || []);
      setSchedules(schedulesData || []);
    } catch (err) {
      console.error('Error fetching manager data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSchedule = () => {
    router.push('/dashboard/manager/schedules/create');
  };

  const handleAddWorker = () => {
    router.push('/dashboard/manager/workers/add');
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
            <p className="text-foreground-muted mb-4">{error}</p>
            <Button onClick={fetchData}>Try Again</Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Manager Dashboard</h1>
        <p className="text-foreground-muted">Create schedules and manage your team</p>
      </div>

      {/* Live Status */}
      <Card className="mb-6 border-success/30 bg-success-muted/10">
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
            <div>
              <p className="font-medium text-foreground">5 Workers Currently Clocked In</p>
              <p className="text-sm text-foreground-muted">Across all locations</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-muted rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{managers.length}</p>
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
                <p className="text-2xl font-bold text-foreground">{places.length}</p>
                <p className="text-xs text-foreground-muted">Places</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-warning-muted rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{schedules.length}</p>
                <p className="text-xs text-foreground-muted">Schedules</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success-muted rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">92%</p>
                <p className="text-xs text-foreground-muted">Fill Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Actions */}
      <Card className="mb-6">
        <CardContent>
          <h3 className="font-semibold text-foreground mb-3">Pending Actions</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-warning-muted/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-warning" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  3 shift requests need approval
                </p>
              </div>
              <Link href="/dashboard/manager/shifts">
                <Button size="sm" variant="secondary">
                  Review
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-3 p-3 bg-primary-muted/20 rounded-lg">
              <Calendar className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Create next week's schedule
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={handleCreateSchedule}>
                Create
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Button
          onClick={handleCreateSchedule}
          className="h-auto py-4 flex-col gap-2"
        >
          <Calendar className="w-6 h-6" />
          <span className="text-sm">Create Schedule</span>
        </Button>

        <Button
          onClick={handleAddWorker}
          variant="secondary"
          className="h-auto py-4 flex-col gap-2"
        >
          <Users className="w-6 h-6" />
          <span className="text-sm">Add Worker</span>
        </Button>

        <Link href="/dashboard/manager/schedules">
          <Button
            variant="secondary"
            className="h-auto py-4 flex-col gap-2 w-full"
          >
            <Clock className="w-6 h-6" />
            <span className="text-sm">View Schedules</span>
          </Button>
        </Link>

        <Link href="/dashboard/manager/documents">
          <Button
            variant="secondary"
            className="h-auto py-4 flex-col gap-2 w-full"
          >
            <FileText className="w-6 h-6" />
            <span className="text-sm">Documents</span>
          </Button>
        </Link>
      </div>

      {/* Recent Schedules */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Recent Schedules</h2>
          <Link href="/dashboard/manager/schedules">
            <Button variant="ghost" size="sm">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        {schedules.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No schedules yet</h3>
              <p className="text-foreground-muted mb-4">
                Create your first schedule to get started
              </p>
              <Button onClick={handleCreateSchedule}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Schedule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <Card key={schedule.id} className="hover:bg-background-secondary transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-muted rounded-lg flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {new Date(schedule.start_date).toLocaleDateString()} - {new Date(schedule.end_date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-foreground-muted">
                        Status: <Badge variant={schedule.status === 'PUBLISHED' ? 'success' : 'warning'}>
                          {schedule.status}
                        </Badge>
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-foreground-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/dashboard/manager/workers">
          <Card className="hover:bg-background-secondary transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-12 h-12 bg-primary-muted rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Manage Workers</p>
                <p className="text-sm text-foreground-muted">
                  Add, edit, and manage worker accounts
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/manager/places">
          <Card className="hover:bg-background-secondary transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
                <MapPin className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Manage Places</p>
                <p className="text-sm text-foreground-muted">
                  Configure work locations
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}
