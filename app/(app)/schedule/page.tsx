'use client';

import { useState } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Users,
} from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from 'date-fns';

interface Shift {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  place: string;
  skill: string;
  coworkers: string[];
}

const mockShifts: Shift[] = [
  {
    id: '1',
    date: new Date(),
    startTime: '09:00',
    endTime: '17:00',
    place: 'Downtown Restaurant',
    skill: 'Waiter',
    coworkers: ['John D.', 'Sarah M.'],
  },
  {
    id: '2',
    date: new Date(Date.now() + 86400000 * 2),
    startTime: '14:00',
    endTime: '22:00',
    place: 'Downtown Restaurant',
    skill: 'Waiter',
    coworkers: ['Mike R.'],
  },
];

export default function SchedulePage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = monthStart.getDay();
  const emptyDays = Array(startDayOfWeek).fill(null);

  const shiftsForSelectedDate = selectedDate
    ? mockShifts.filter((shift) => isSameDay(shift.date, selectedDate))
    : [];

  const hasShiftOnDay = (date: Date) =>
    mockShifts.some((shift) => isSameDay(shift.date, date));

  return (
    <PageContainer title="My Schedule">
      {/* Month Navigation */}
      <Card className="mb-4">
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-background-tertiary rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-foreground-muted" />
            </button>
            <h2 className="text-lg font-semibold text-foreground">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-background-tertiary rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </button>
          </div>

          {/* Day Labels */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center text-xs text-foreground-muted py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {emptyDays.map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}
            {days.map((day) => {
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const hasShift = hasShiftOnDay(day);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors relative ${
                    isSelected
                      ? 'bg-primary text-white'
                      : isToday(day)
                      ? 'bg-background-tertiary text-foreground'
                      : isSameMonth(day, currentMonth)
                      ? 'text-foreground hover:bg-background-tertiary'
                      : 'text-foreground-muted'
                  }`}
                >
                  {format(day, 'd')}
                  {hasShift && (
                    <div
                      className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-primary'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Shifts */}
      <div className="space-y-3">
        {selectedDate && (
          <h3 className="text-sm font-medium text-foreground-muted">
            {format(selectedDate, 'EEEE, MMMM d')}
          </h3>
        )}

        {shiftsForSelectedDate.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-foreground-muted">No shifts scheduled</p>
            </CardContent>
          </Card>
        ) : (
          shiftsForSelectedDate.map((shift) => (
            <Card key={shift.id}>
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <Badge variant="info">{shift.skill}</Badge>
                  <div className="flex items-center gap-1 text-sm text-foreground-muted">
                    <Clock className="w-4 h-4" />
                    {shift.startTime} - {shift.endTime}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-foreground-muted" />
                  <span className="text-foreground">{shift.place}</span>
                </div>

                {shift.coworkers.length > 0 && (
                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <Users className="w-4 h-4 text-foreground-muted" />
                    <span className="text-sm text-foreground-muted">
                      Working with: {shift.coworkers.join(', ')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}
