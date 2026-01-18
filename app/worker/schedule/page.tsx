'use client';

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { Calendar, Clock, MapPin, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function WorkerSchedulePage() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      const supabase = createClient();
      // Fetch shifts assigned to the current worker
      const { data, error } = await supabase
        .from('shifts')
        .select(`
          *,
          places (
            name
          )
        `)
        .eq('worker_id', (await supabase.auth.getUser()).data.user?.id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer
      title="My Schedule"
      description="View your work schedule"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Your Shifts</h2>
          <Button variant="outline">
            <Calendar className="w-4 h-4 mr-2" />
            View Calendar
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading your schedule...</div>
        ) : shifts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No shifts scheduled</h3>
              <p className="text-muted-foreground">
                You don't have any shifts scheduled yet
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {shifts.map((shift) => (
              <Card key={shift.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">
                        {new Date(shift.start_time).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </h4>
                      <p className="text-sm text-muted-foreground flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {new Date(shift.start_time).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })} - {new Date(shift.end_time).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center mt-1">
                        <MapPin className="w-4 h-4 mr-1" />
                        {shift.places?.name}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <Badge variant={shift.status === 'COMPLETED' ? 'success' : shift.status === 'IN_PROGRESS' ? 'warning' : 'info'}>
                        {shift.status}
                      </Badge>
                      {shift.status === 'SCHEDULED' && (
                        <Button size="sm">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Clock In
                        </Button>
                      )}
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
