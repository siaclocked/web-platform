'use client';

import { useState } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge, Select } from '@/components/ui';
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Send,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  format,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
} from 'date-fns';
import Link from 'next/link';

interface Shift {
  id: string;
  workerId: string;
  workerName: string;
  skillName: string;
  startTime: string;
  endTime: string;
  isLocked: boolean;
  isOpen: boolean;
}

interface DaySchedule {
  date: Date;
  shifts: Shift[];
  coverageGaps: number;
}

const mockSchedule: DaySchedule[] = [];

const placeOptions = [
  { value: '1', label: 'Downtown Restaurant' },
  { value: '2', label: 'Mall Location' },
  { value: '3', label: 'Airport Branch' },
];

export default function SchedulesPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedPlace, setSelectedPlace] = useState('1');
  const [scheduleStatus, setScheduleStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const mockShifts: { [key: string]: Shift[] } = {
    [format(weekDays[0], 'yyyy-MM-dd')]: [
      {
        id: '1',
        workerId: '1',
        workerName: 'John D.',
        skillName: 'Waiter',
        startTime: '09:00',
        endTime: '17:00',
        isLocked: false,
        isOpen: false,
      },
      {
        id: '2',
        workerId: '2',
        workerName: 'Sarah M.',
        skillName: 'Cook',
        startTime: '08:00',
        endTime: '16:00',
        isLocked: true,
        isOpen: false,
      },
    ],
    [format(weekDays[1], 'yyyy-MM-dd')]: [
      {
        id: '3',
        workerId: '1',
        workerName: 'John D.',
        skillName: 'Waiter',
        startTime: '14:00',
        endTime: '22:00',
        isLocked: false,
        isOpen: false,
      },
      {
        id: '4',
        workerId: '',
        workerName: '',
        skillName: 'Security',
        startTime: '18:00',
        endTime: '02:00',
        isLocked: false,
        isOpen: true,
      },
    ],
  };

  const handleGenerateSchedule = () => {
    console.log('Generating schedule...');
    // Call solver API
  };

  const handlePublishSchedule = () => {
    setScheduleStatus('PUBLISHED');
  };

  return (
    <PageContainer
      title="Schedules"
      action={
        <Link href="/schedules/create">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </Link>
      }
    >
      {/* Place Selector */}
      <div className="mb-4">
        <Select
          options={placeOptions}
          value={selectedPlace}
          onChange={(e) => setSelectedPlace(e.target.value)}
        />
      </div>

      {/* Week Navigation */}
      <Card className="mb-4">
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
              className="p-2 hover:bg-background-tertiary rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-foreground-muted" />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </h2>
              <Badge
                variant={scheduleStatus === 'PUBLISHED' ? 'success' : 'warning'}
              >
                {scheduleStatus}
              </Badge>
            </div>
            <button
              onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
              className="p-2 hover:bg-background-tertiary rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={handleGenerateSchedule}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Generate
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handlePublishSchedule}
              disabled={scheduleStatus === 'PUBLISHED'}
            >
              <Send className="w-4 h-4 mr-1" />
              Publish
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Grid */}
      <div className="space-y-3">
        {weekDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const shifts = mockShifts[dateKey] || [];
          const openShifts = shifts.filter((s) => s.isOpen).length;

          return (
            <Card key={dateKey}>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {format(day, 'EEEE')}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      {format(day, 'MMMM d')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {openShifts > 0 && (
                      <Badge variant="warning">
                        {openShifts} open shift{openShifts > 1 ? 's' : ''}
                      </Badge>
                    )}
                    <span className="text-sm text-foreground-muted">
                      {shifts.length} shifts
                    </span>
                  </div>
                </div>

                {shifts.length > 0 ? (
                  <div className="space-y-2">
                    {shifts.map((shift) => (
                      <div
                        key={shift.id}
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          shift.isOpen
                            ? 'bg-warning-muted/20 border border-warning/30'
                            : 'bg-background-tertiary'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {shift.isOpen ? (
                              <span className="text-warning font-medium">
                                Open Shift
                              </span>
                            ) : (
                              <span className="font-medium text-foreground">
                                {shift.workerName}
                              </span>
                            )}
                            {shift.isLocked && (
                              <Lock className="w-4 h-4 text-foreground-muted" />
                            )}
                          </div>
                          <p className="text-sm text-foreground-muted">
                            {shift.skillName} • {shift.startTime} -{' '}
                            {shift.endTime}
                          </p>
                        </div>
                        <button className="p-2 hover:bg-background-secondary rounded-lg transition-colors">
                          {shift.isLocked ? (
                            <Unlock className="w-4 h-4 text-foreground-muted" />
                          ) : (
                            <Lock className="w-4 h-4 text-foreground-muted" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-foreground-muted">
                    No shifts scheduled
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}
