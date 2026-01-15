'use client';

import { useState } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Input, Toggle, Badge } from '@/components/ui';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  Palmtree,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
  isAfter,
} from 'date-fns';

type AvailabilityType = 'full_day' | 'time_range' | 'vacation';

interface Availability {
  id: string;
  date: Date;
  type: AvailabilityType;
  startTime?: string;
  endTime?: string;
  isPaidLeave: boolean;
}

const mockAvailabilities: Availability[] = [
  {
    id: '1',
    date: new Date(Date.now() + 86400000 * 3),
    type: 'full_day',
    isPaidLeave: false,
  },
  {
    id: '2',
    date: new Date(Date.now() + 86400000 * 5),
    type: 'time_range',
    startTime: '09:00',
    endTime: '14:00',
    isPaidLeave: false,
  },
];

export default function AvailabilityPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [availabilities, setAvailabilities] = useState(mockAvailabilities);

  // Form state
  const [availType, setAvailType] = useState<AvailabilityType>('full_day');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [isPaidLeave, setIsPaidLeave] = useState(false);

  // Mock published horizon - workers can only submit availability up to this date
  const publishedHorizonEnd = new Date(Date.now() + 86400000 * 14); // 2 weeks from now

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = monthStart.getDay();
  const emptyDays = Array(startDayOfWeek).fill(null);

  const getAvailabilityForDate = (date: Date) =>
    availabilities.find((a) => isSameDay(a.date, date));

  const canSubmitAvailability = (date: Date) =>
    !isAfter(date, publishedHorizonEnd) && isAfter(date, new Date());

  const handleSaveAvailability = () => {
    if (!selectedDate) return;

    const newAvailability: Availability = {
      id: Date.now().toString(),
      date: selectedDate,
      type: availType,
      startTime: availType === 'time_range' ? startTime : undefined,
      endTime: availType === 'time_range' ? endTime : undefined,
      isPaidLeave: availType === 'vacation' ? isPaidLeave : false,
    };

    setAvailabilities([...availabilities, newAvailability]);
    setShowForm(false);
    setSelectedDate(null);
  };

  const handleDeleteAvailability = (id: string) => {
    setAvailabilities(availabilities.filter((a) => a.id !== id));
  };

  return (
    <PageContainer
      title="My Availability"
      description="Set when you're available to work"
    >
      {/* Info Banner */}
      <Card className="mb-4 border-primary/30 bg-primary-muted/10">
        <CardContent className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm text-foreground">
              You can submit availability up to{' '}
              <span className="font-medium">
                {format(publishedHorizonEnd, 'MMMM d, yyyy')}
              </span>
            </p>
            <p className="text-xs text-foreground-muted mt-1">
              For dates beyond this, please contact your manager
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
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
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div
                key={i}
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
              const availability = getAvailabilityForDate(day);
              const canSubmit = canSubmitAvailability(day);
              const isPast = !isAfter(day, new Date());

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    if (canSubmit && !availability) {
                      setSelectedDate(day);
                      setShowForm(true);
                    }
                  }}
                  disabled={isPast || !canSubmit}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors relative ${
                    availability
                      ? availability.type === 'vacation'
                        ? 'bg-warning-muted text-warning'
                        : 'bg-success-muted text-success'
                      : isToday(day)
                      ? 'bg-background-tertiary text-foreground'
                      : canSubmit
                      ? 'text-foreground hover:bg-background-tertiary'
                      : 'text-foreground-muted opacity-50'
                  }`}
                >
                  {format(day, 'd')}
                  {availability && (
                    <div
                      className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                        availability.type === 'vacation'
                          ? 'bg-warning'
                          : 'bg-success'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Availability */}
      <h3 className="text-sm font-medium text-foreground-muted mb-3">
        Upcoming Availability
      </h3>
      <div className="space-y-2">
        {availabilities
          .filter((a) => isAfter(a.date, new Date()))
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .map((avail) => (
            <Card key={avail.id}>
              <CardContent className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    avail.type === 'vacation'
                      ? 'bg-warning-muted'
                      : 'bg-success-muted'
                  }`}
                >
                  {avail.type === 'vacation' ? (
                    <Palmtree
                      className={`w-5 h-5 ${
                        avail.type === 'vacation' ? 'text-warning' : 'text-success'
                      }`}
                    />
                  ) : (
                    <Clock className="w-5 h-5 text-success" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {format(avail.date, 'EEEE, MMM d')}
                  </p>
                  <p className="text-sm text-foreground-muted">
                    {avail.type === 'full_day'
                      ? 'Available all day'
                      : avail.type === 'time_range'
                      ? `${avail.startTime} - ${avail.endTime}`
                      : avail.isPaidLeave
                      ? 'Paid vacation'
                      : 'Unpaid leave'}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteAvailability(avail.id)}
                  className="p-2 hover:bg-danger-muted rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-danger" />
                </button>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Add Availability Modal */}
      {showForm && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Set Availability
              </h2>
              <p className="text-sm text-foreground-muted mb-4">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'full_day', label: 'Full Day' },
                      { value: 'time_range', label: 'Time Range' },
                      { value: 'vacation', label: 'Vacation' },
                    ].map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setAvailType(type.value as AvailabilityType)}
                        className={`p-3 rounded-lg border text-sm ${
                          availType === type.value
                            ? 'border-primary bg-primary-muted text-primary'
                            : 'border-border text-foreground-muted'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {availType === 'time_range' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Start Time"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                    <Input
                      label="End Time"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                )}

                {availType === 'vacation' && (
                  <Toggle
                    checked={isPaidLeave}
                    onChange={setIsPaidLeave}
                    label="Paid leave"
                  />
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setShowForm(false);
                      setSelectedDate(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleSaveAvailability}>
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
