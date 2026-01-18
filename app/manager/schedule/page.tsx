'use client';

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { Calendar, Plus, Users, Clock, Edit } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ManagerSchedulePage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const supabase = createClient();
      // Fetch schedules for the current manager's places
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          places (
            name
          )
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer
      title="Schedule"
      description="Manage your schedules"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Your Schedules</h2>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Schedule
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading schedules...</div>
        ) : schedules.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No schedules yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first schedule
              </p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Schedule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {schedules.map((schedule) => (
              <Card key={schedule.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{schedule.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {schedule.places?.name} • {schedule.start_date} to {schedule.end_date}
                      </p>
                      <div className="flex items-center space-x-4 mt-2">
                        <Badge variant={schedule.status === 'PUBLISHED' ? 'success' : 'warning'}>
                          {schedule.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {schedule.worker_count || 0} workers
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline">
                        View Details
                      </Button>
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
