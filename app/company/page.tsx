'use client';

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { Building2, Users, Calendar, FileText, Plus, TrendingUp, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function CompanyPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalManagers: 0,
    totalWorkers: 0,
    totalPlaces: 0,
    activeSchedules: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Get auth token
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      // Use service role API to bypass RLS issues
      const response = await fetch('/api/company/stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
      });
      
      if (response.ok) {
        const statsData = await response.json();
        setStats(statsData);
      } else {
        // Fallback to placeholder data
        setStats({
          totalManagers: 0,
          totalWorkers: 0,
          totalPlaces: 0,
          activeSchedules: 0
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats({
        totalManagers: 0,
        totalWorkers: 0,
        totalPlaces: 0,
        activeSchedules: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer
      title="Company Dashboard"
      description="Overview of your organization"
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{stats.totalManagers}</div>
              <div className="text-sm text-muted-foreground">Managers</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">{stats.totalWorkers}</div>
              <div className="text-sm text-muted-foreground">Workers</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold">{stats.totalPlaces}</div>
              <div className="text-sm text-muted-foreground">Places</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <div className="text-2xl font-bold">{stats.activeSchedules}</div>
              <div className="text-sm text-muted-foreground">Active Schedules</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Managers</h3>
                <Button onClick={() => router.push('/company/managers')}>
                  View All
                </Button>
              </div>
              <p className="text-muted-foreground mb-4">
                Manage your team managers
              </p>
              <Button className="w-full" onClick={() => router.push('/company/managers/add')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Manager
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Places</h3>
                <Button onClick={() => router.push('/company/places')}>
                  View All
                </Button>
              </div>
              <p className="text-muted-foreground mb-4">
                View work locations across all managers
              </p>
              <Button className="w-full" onClick={() => router.push('/company/places')}>
                <MapPin className="w-4 h-4 mr-2" />
                View Places
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Documents</h3>
                <Button onClick={() => router.push('/company/documents')}>
                  View All
                </Button>
              </div>
              <p className="text-muted-foreground mb-4">
                Manage company documents
              </p>
              <Button className="w-full" onClick={() => router.push('/company/documents')}>
                <FileText className="w-4 h-4 mr-2" />
                View Documents
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
