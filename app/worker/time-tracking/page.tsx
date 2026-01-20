'use client';

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Select, Input, Badge } from '@/components/ui';
import { BackButton } from '@/components/ui';
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

export default function WorkerTimeTrackingPage() {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [selectedPlace, setSelectedPlace] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [sessionDuration, setSessionDuration] = useState(0);
  const [checklistItems, setChecklistItems] = useState([
    { id: '1', text: 'Wash hands', completed: false },
    { id: '2', text: 'Check equipment', completed: false },
    { id: '3', text: 'Review schedule', completed: false },
  ]);
  const [handoffNote, setHandoffNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check for active session
    const mockActiveSession: ActiveSession = {
      id: 'session-1',
      placeId: '1',
      placeName: 'Downtown Restaurant',
      skillId: '1',
      skillName: 'Waiter',
      startTime: new Date(Date.now() - 3600000), // 1 hour ago
      isScheduled: true,
    };
    
    // For demo, start with no active session
    // setActiveSession(mockActiveSession);
  }, []);

  useEffect(() => {
    if (activeSession) {
      const interval = setInterval(() => {
        setSessionDuration(Date.now() - activeSession.startTime.getTime());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [activeSession]);

  const handleClockIn = async () => {
    if (!selectedPlace || !selectedSkill) {
      alert('Please select a place and skill');
      return;
    }

    setIsLoading(true);
    try {
      // Mock clock in - replace with actual API call
      const newSession: ActiveSession = {
        id: `session-${Date.now()}`,
        placeId: selectedPlace,
        placeName: mockPlaces.find(p => p.value === selectedPlace)?.label || '',
        skillId: selectedSkill,
        skillName: mockSkills.find(s => s.value === selectedSkill)?.label || '',
        startTime: new Date(),
        isScheduled: false,
      };

      setActiveSession(newSession);
      setSelectedPlace('');
      setSelectedSkill('');
    } catch (error) {
      console.error('Clock in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    setIsLoading(true);
    try {
      // Mock clock out - replace with actual API call
      if (handoffNote.trim()) {
        console.log('Saving handoff note:', handoffNote);
      }
      
      setActiveSession(null);
      setHandoffNote('');
      setChecklistItems(items => items.map(item => ({ ...item, completed: false })));
    } catch (error) {
      console.error('Clock out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChecklistItem = (itemId: string) => {
    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    );
  };

  if (activeSession) {
    return (
      <PageContainer>
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <BackButton href="/worker" label="Back to Dashboard" className="mb-4" />
            <h1 className="text-2xl font-bold text-foreground">Currently Working</h1>
            <p className="text-foreground-muted">
              {activeSession.placeName} • {activeSession.skillName}
            </p>
          </div>

          {/* Active Session Card */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-foreground mb-2">
                  {formatDuration(sessionDuration)}
                </div>
                <p className="text-muted-foreground">
                  Started at {activeSession.startTime.toLocaleTimeString()}
                </p>
                {activeSession.isScheduled && (
                  <Badge variant="success" className="mt-2">
                    Scheduled Shift
                  </Badge>
                )}
              </div>

              {/* Checklist */}
              <div className="mb-6">
                <h3 className="font-medium text-foreground mb-3 flex items-center">
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Shift Checklist
                </h3>
                <div className="space-y-2">
                  {checklistItems.map(item => (
                    <label
                      key={item.id}
                      className="flex items-center space-x-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => toggleChecklistItem(item.id)}
                        className="w-4 h-4 text-primary rounded"
                      />
                      <span className={item.completed ? 'line-through text-muted-foreground' : ''}>
                        {item.text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Handoff Note */}
              <div className="mb-6">
                <h3 className="font-medium text-foreground mb-3 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Handoff Note (Optional)
                </h3>
                <Input
                  placeholder="Add notes for the next shift..."
                  value={handoffNote}
                  onChange={(e) => setHandoffNote(e.target.value)}
                />
              </div>

              {/* Clock Out Button */}
              <Button
                onClick={handleClockOut}
                isLoading={isLoading}
                className="w-full"
                variant="danger"
              >
                <Square className="w-4 h-4 mr-2" />
                Clock Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/worker" label="Back to Dashboard" className="mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Time Tracking</h1>
          <p className="text-foreground-muted">
            Start a work session to track your hours
          </p>
        </div>

        {/* Clock In Form */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Place
                </label>
                <Select
                  value={selectedPlace}
                  onChange={(e) => setSelectedPlace(e.target.value)}
                >
                  <option value="">Select a place</option>
                  {mockPlaces.map(place => (
                    <option key={place.value} value={place.value}>
                      {place.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Skill/Position
                </label>
                <Select
                  value={selectedSkill}
                  onChange={(e) => setSelectedSkill(e.target.value)}
                >
                  <option value="">Select a skill</option>
                  {mockSkills.map(skill => (
                    <option key={skill.value} value={skill.value}>
                      {skill.label}
                    </option>
                  ))}
                </Select>
              </div>

              <Button
                onClick={handleClockIn}
                isLoading={isLoading}
                disabled={!selectedPlace || !selectedSkill}
                className="w-full"
              >
                <Play className="w-4 h-4 mr-2" />
                Clock In
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="font-medium text-foreground mb-4">Recent Sessions</h3>
            <p className="text-muted-foreground text-center py-4">
              No recent sessions
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
