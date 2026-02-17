'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { Calendar, Clock, MapPin, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  place: string;
  skill: string;
  isAvailable: boolean;
}

interface TimeFrame {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'published' | 'draft';
}

export default function SetAvailabilityPage() {
  const router = useRouter();
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  useEffect(() => {
    fetchTimeFrames();
  }, []);

  useEffect(() => {
    if (selectedTimeFrame) {
      fetchShifts();
    }
  }, [selectedTimeFrame]);

  const fetchTimeFrames = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // For now, create mock timeframes based on current date
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + (currentWeekOffset * 7));
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const timeFrame: TimeFrame = {
        id: `week-${currentWeekOffset}`,
        name: currentWeekOffset === 0 ? 'This Week' : 
              currentWeekOffset === 1 ? 'Next Week' : 
              currentWeekOffset === -1 ? 'Last Week' :
              `Week of ${startOfWeek.toLocaleDateString()}`,
        startDate: startOfWeek.toISOString().split('T')[0],
        endDate: endOfWeek.toISOString().split('T')[0],
        status: 'published'
      };

      setSelectedTimeFrame(timeFrame);
    } catch (error) {
      console.error('Error fetching time frames:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShifts = async () => {
    if (!selectedTimeFrame) return;

    try {
      // Mock shifts for demonstration
      const mockShifts: Shift[] = [
        {
          id: '1',
          date: selectedTimeFrame.startDate,
          startTime: '09:00',
          endTime: '14:00',
          place: 'Main Restaurant',
          skill: 'Waiter',
          isAvailable: false
        },
        {
          id: '2',
          date: selectedTimeFrame.startDate,
          startTime: '14:00',
          endTime: '19:00',
          place: 'Main Restaurant',
          skill: 'Waiter',
          isAvailable: false
        },
        {
          id: '3',
          date: selectedTimeFrame.startDate,
          startTime: '09:00',
          endTime: '17:00',
          place: 'Kitchen',
          skill: 'Cook',
          isAvailable: false
        },
        {
          id: '4',
          date: new Date(selectedTimeFrame.startDate).getTime() + 86400000 + '',
          startTime: '10:00',
          endTime: '15:00',
          place: 'Main Restaurant',
          skill: 'Waiter',
          isAvailable: false
        },
        {
          id: '5',
          date: new Date(selectedTimeFrame.startDate).getTime() + 86400000 + '',
          startTime: '15:00',
          endTime: '20:00',
          place: 'Main Restaurant',
          skill: 'Waiter',
          isAvailable: false
        }
      ];

      setShifts(mockShifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  };

  const toggleShiftAvailability = (shiftId: string) => {
    setShifts(prev => prev.map(shift => 
      shift.id === shiftId 
        ? { ...shift, isAvailable: !shift.isAvailable }
        : shift
    ));
  };

  const saveAvailability = async () => {
    setSaving(true);
    try {
      // Here you would save to the database
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      console.log('Availability saved:', shifts.filter(s => s.isAvailable));
    } catch (error) {
      console.error('Error saving availability:', error);
    } finally {
      setSaving(false);
    }
  };

  const changeWeek = (direction: number) => {
    setCurrentWeekOffset(prev => prev + direction);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
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

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Set Availability</h1>
          <Button 
            onClick={saveAvailability} 
            isLoading={saving}
            disabled={!shifts.some(s => s.isAvailable)}
          >
            Save Availability
          </Button>
        </div>

        {/* Time Frame Selector */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {selectedTimeFrame?.name || 'Select Time Frame'}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => changeWeek(-1)}
                  disabled={currentWeekOffset <= -2}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-foreground-muted min-w-[100px] text-center">
                  {selectedTimeFrame?.startDate && 
                    new Date(selectedTimeFrame.startDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                  })} - {selectedTimeFrame?.endDate && 
                    new Date(selectedTimeFrame.endDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => changeWeek(1)}
                  disabled={currentWeekOffset >= 4}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {selectedTimeFrame?.status === 'published' && (
              <Badge variant="success" className="mb-4">Published Schedule</Badge>
            )}

            <div className="text-sm text-foreground-muted">
              Select the shifts you are available to work. Manager will review and approve.
            </div>
          </CardContent>
        </Card>

        {/* Shifts List */}
        <div className="space-y-4">
          {shifts.map((shift) => (
            <Card 
              key={shift.id}
              className={`cursor-pointer transition-all ${
                shift.isAvailable 
                  ? 'border-success bg-success-muted/10' 
                  : 'hover:bg-background-secondary'
              }`}
              onClick={() => toggleShiftAvailability(shift.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-foreground-muted" />
                      <span className="font-medium text-foreground">
                        {formatDate(shift.date)}
                      </span>
                      <Badge variant="default">
                        {shift.skill}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-foreground-muted" />
                        <span className="text-foreground">
                          {shift.startTime} - {shift.endTime}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-foreground-muted" />
                        <span className="text-foreground-muted">{shift.place}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {shift.isAvailable ? (
                      <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-success-foreground" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 border-2 border-border rounded-full" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {shifts.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-foreground-muted">No shifts available for this time period</p>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        {shifts.some(s => s.isAvailable) && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-3">Availability Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground-muted">Selected shifts:</span>
                  <span className="font-medium text-foreground">
                    {shifts.filter(s => s.isAvailable).length} of {shifts.length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground-muted">Total hours:</span>
                  <span className="font-medium text-foreground">
                    {shifts
                      .filter(s => s.isAvailable)
                      .reduce((total, shift) => {
                        const start = new Date(`2000-01-01T${shift.startTime}`);
                        const end = new Date(`2000-01-01T${shift.endTime}`);
                        return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                      }, 0)
                      .toFixed(1)}h
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
