'use client';

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Select, Input, Badge } from '@/components/ui';
import { Play, Square, Clock, MapPin, CheckSquare, MessageSquare } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

interface ActiveSession {
  id: string;
  placeId: string;
  placeName: string;
  skillId: string;
  skillName: string;
  startTime: Date;
  isScheduled: boolean;
}

const mockPlaces = [
  { value: '1', label: 'Downtown Restaurant' },
  { value: '2', label: 'Mall Location' },
  { value: '3', label: 'Airport Branch' },
];

const mockSkills = [
  { value: '1', label: 'Waiter' },
  { value: '2', label: 'Cook' },
  { value: '3', label: 'Security' },
];

export default function TimeTrackingPage() {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [showStopModal, setShowStopModal] = useState(false);
  const [handoffNote, setHandoffNote] = useState('');
  const [handoffAudience, setHandoffAudience] = useState<'NEXT_IN_SKILL' | 'NEXT_SHIFT_ALL'>('NEXT_IN_SKILL');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeSession) {
      interval = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - activeSession.startTime.getTime()) / 1000 / 60
        );
        setElapsedTime(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleStartSession = () => {
    if (!selectedPlace || !selectedSkill) return;

    const place = mockPlaces.find((p) => p.value === selectedPlace);
    const skill = mockSkills.find((s) => s.value === selectedSkill);

    setActiveSession({
      id: Date.now().toString(),
      placeId: selectedPlace,
      placeName: place?.label || '',
      skillId: selectedSkill,
      skillName: skill?.label || '',
      startTime: new Date(),
      isScheduled: false,
    });
    setElapsedTime(0);
  };

  const handleStopSession = () => {
    setShowStopModal(true);
  };

  const confirmStopSession = () => {
    // Here you would save the session and handoff note
    console.log('Session ended', { activeSession, handoffNote, handoffAudience });
    setActiveSession(null);
    setShowStopModal(false);
    setHandoffNote('');
    setSelectedPlace('');
    setSelectedSkill('');
  };

  return (
    <PageContainer title="Time Tracking">
      {activeSession ? (
        <div className="space-y-4">
          {/* Active Session Display */}
          <Card className="border-success/50 bg-success-muted/10">
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
                <span className="text-success font-medium">Currently Working</span>
                {!activeSession.isScheduled && (
                  <Badge variant="warning">Unscheduled</Badge>
                )}
              </div>

              <div className="text-center py-6">
                <div className="text-5xl font-bold text-foreground mb-2">
                  {formatDuration(elapsedTime)}
                </div>
                <p className="text-foreground-muted">
                  Started at{' '}
                  {activeSession.startTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              <div className="flex items-center gap-3 py-3 border-t border-border">
                <MapPin className="w-5 h-5 text-foreground-muted" />
                <div>
                  <p className="font-medium text-foreground">
                    {activeSession.placeName}
                  </p>
                  <p className="text-sm text-foreground-muted">
                    {activeSession.skillName}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stop Button */}
          <Button
            onClick={handleStopSession}
            variant="danger"
            className="w-full py-4"
            size="lg"
          >
            <Square className="w-5 h-5 mr-2" />
            Clock Out
          </Button>

          {/* Checklist */}
          <Card>
            <CardContent>
              <h3 className="font-semibold text-foreground mb-3">
                Shift Checklist
              </h3>
              <div className="space-y-2">
                {['Clean work area', 'Check inventory', 'Review tasks'].map(
                  (item, index) => (
                    <label
                      key={index}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-background-tertiary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded border-border accent-primary"
                      />
                      <span className="text-foreground">{item}</span>
                    </label>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stop Modal */}
          {showStopModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <Card className="w-full max-w-md">
                <CardContent className="pt-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    End Work Session
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        <MessageSquare className="w-4 h-4 inline mr-2" />
                        Handoff Note (Optional)
                      </label>
                      <textarea
                        value={handoffNote}
                        onChange={(e) => setHandoffNote(e.target.value)}
                        placeholder="Leave a note for the next worker..."
                        className="w-full px-4 py-3 rounded-lg resize-none"
                        rows={3}
                      />
                    </div>

                    {handoffNote && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Share with
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setHandoffAudience('NEXT_IN_SKILL')}
                            className={`p-3 rounded-lg border text-sm ${
                              handoffAudience === 'NEXT_IN_SKILL'
                                ? 'border-primary bg-primary-muted text-primary'
                                : 'border-border text-foreground-muted'
                            }`}
                          >
                            Same skill only
                          </button>
                          <button
                            onClick={() => setHandoffAudience('NEXT_SHIFT_ALL')}
                            className={`p-3 rounded-lg border text-sm ${
                              handoffAudience === 'NEXT_SHIFT_ALL'
                                ? 'border-primary bg-primary-muted text-primary'
                                : 'border-border text-foreground-muted'
                            }`}
                          >
                            All next shift
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => setShowStopModal(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        className="flex-1"
                        onClick={confirmStopSession}
                      >
                        Confirm Clock Out
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Start Session Form */}
          <Card>
            <CardContent>
              <h3 className="font-semibold text-foreground mb-4">
                Start Work Session
              </h3>

              <div className="space-y-4">
                <Select
                  label="Select Place"
                  options={mockPlaces}
                  value={selectedPlace}
                  onChange={(e) => setSelectedPlace(e.target.value)}
                  placeholder="Choose a location..."
                />

                <Select
                  label="Select Position"
                  options={mockSkills}
                  value={selectedSkill}
                  onChange={(e) => setSelectedSkill(e.target.value)}
                  placeholder="Choose your role..."
                />

                <Button
                  onClick={handleStartSession}
                  className="w-full py-4"
                  size="lg"
                  disabled={!selectedPlace || !selectedSkill}
                >
                  <Play className="w-5 h-5 mr-2" />
                  Clock In
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Today's Scheduled Shift */}
          <Card>
            <CardContent>
              <h3 className="font-semibold text-foreground mb-3">
                Today&apos;s Scheduled Shift
              </h3>
              <div className="flex items-center gap-4 p-3 bg-background-tertiary rounded-lg">
                <div className="w-10 h-10 bg-primary-muted rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">9:00 AM - 5:00 PM</p>
                  <p className="text-sm text-foreground-muted">
                    Downtown Restaurant • Waiter
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedPlace('1');
                    setSelectedSkill('1');
                  }}
                >
                  Select
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Sessions */}
          <Card>
            <CardContent>
              <h3 className="font-semibold text-foreground mb-3">
                Recent Sessions
              </h3>
              <div className="space-y-3">
                {[
                  { date: 'Yesterday', hours: '8h 15m', place: 'Downtown Restaurant' },
                  { date: 'Jan 13', hours: '6h 45m', place: 'Mall Location' },
                ].map((session, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {session.date}
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {session.place}
                      </p>
                    </div>
                    <span className="text-sm text-foreground">{session.hours}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
