'use client';

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { BackButton } from '@/components/ui';
import { Layers, Plus, Trash2, Clock, Users, MapPin, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CoverageTemplate {
  id: string;
  place_id: string;
  skill_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  min_workers: number;
  max_workers: number | null;
  created_at: string;
}

interface Place {
  id: string;
  name: string;
}

interface Skill {
  id: string;
  name: string;
  color?: string;
}

export default function CoverageTemplatesPage() {
  const [templates, setTemplates] = useState<CoverageTemplate[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    skill_id: '',
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00',
    min_workers: 1,
    max_workers: '',
  });

  useEffect(() => {
    fetchPlacesAndSkills();
  }, []);

  useEffect(() => {
    if (selectedPlace) {
      fetchTemplates();
    }
  }, [selectedPlace]);

  const getSession = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  };

  const fetchPlacesAndSkills = async () => {
    try {
      const session = await getSession();
      if (!session) return;

      const headers = { 'Authorization': `Bearer ${session.access_token}` };

      const [placesRes, skillsRes] = await Promise.all([
        fetch('/api/manager/places', { headers }),
        fetch('/api/manager/positions', { headers }),
      ]);

      if (placesRes.ok) {
        const data = await placesRes.json();
        const p = data.places || [];
        setPlaces(p);
        if (p.length > 0 && !selectedPlace) {
          setSelectedPlace(p[0].id);
        }
      }

      if (skillsRes.ok) {
        const data = await skillsRes.json();
        setSkills(data.positions || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const session = await getSession();
      if (!session) return;

      const res = await fetch(`/api/manager/coverage-templates?place_id=${selectedPlace}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  const handleAdd = async () => {
    setError('');
    setSuccess('');

    if (!form.skill_id) {
      setError('Please select a skill');
      return;
    }

    if (form.start_time >= form.end_time) {
      setError('Start time must be before end time');
      return;
    }

    try {
      const session = await getSession();
      if (!session) return;

      const res = await fetch('/api/manager/coverage-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          place_id: selectedPlace,
          skill_id: form.skill_id,
          day_of_week: form.day_of_week,
          start_time: form.start_time,
          end_time: form.end_time,
          min_workers: form.min_workers,
          max_workers: form.max_workers ? parseInt(form.max_workers) : null,
        }),
      });

      if (res.ok) {
        setSuccess('Coverage window added');
        setIsAdding(false);
        setForm({ skill_id: '', day_of_week: 1, start_time: '09:00', end_time: '17:00', min_workers: 1, max_workers: '' });
        fetchTemplates();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add coverage window');
      }
    } catch (err) {
      setError('Failed to add coverage window');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this coverage window?')) return;

    try {
      const session = await getSession();
      if (!session) return;

      const res = await fetch(`/api/manager/coverage-templates?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setSuccess('Coverage window deleted');
        fetchTemplates();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete');
      }
    } catch (err) {
      setError('Failed to delete');
    }
  };

  const getSkillName = (skillId: string) => skills.find(s => s.id === skillId)?.name || 'Unknown';
  const getSkillColor = (skillId: string) => skills.find(s => s.id === skillId)?.color || '#3b82f6';

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  // Group templates by day_of_week
  const templatesByDay: Record<number, CoverageTemplate[]> = {};
  templates.forEach(t => {
    if (!templatesByDay[t.day_of_week]) templatesByDay[t.day_of_week] = [];
    templatesByDay[t.day_of_week].push(t);
  });

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton href="/manager" label="Back to Dashboard" className="mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Coverage Templates</h1>
              <p className="text-foreground-muted">
                Define weekly staffing requirements per place and skill
              </p>
            </div>
            <Button
              onClick={() => {
                if (skills.length > 0) {
                  setForm(f => ({ ...f, skill_id: f.skill_id || skills[0].id }));
                }
                setIsAdding(true);
                setError('');
              }}
              disabled={!selectedPlace || skills.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Window
            </Button>
          </div>
        </div>

        {/* Place Selector */}
        {places.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1">Place</label>
            <select
              value={selectedPlace}
              onChange={(e) => setSelectedPlace(e.target.value)}
              className="w-full max-w-xs p-2 border border-border rounded-lg text-sm"
            >
              {places.map(place => (
                <option key={place.id} value={place.id}>{place.name}</option>
              ))}
            </select>
          </div>
        )}

        {places.length === 1 && (
          <div className="mb-4 flex items-center gap-2 text-sm text-foreground-muted">
            <MapPin className="w-4 h-4" />
            <span>{places[0].name}</span>
          </div>
        )}

        {places.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
              <h3 className="text-lg font-medium mb-2">No places yet</h3>
              <p className="text-foreground-muted">Create a place first before adding coverage templates.</p>
            </CardContent>
          </Card>
        )}

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-danger-muted/20 border border-danger/30 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-danger" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-success-muted/20 border border-success/30 rounded-lg">
            <p className="text-sm text-success">{success}</p>
          </div>
        )}

        {/* Add Form */}
        {isAdding && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">New Coverage Window</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">Skill *</label>
                  <select
                    value={form.skill_id}
                    onChange={(e) => setForm(f => ({ ...f, skill_id: e.target.value }))}
                    className="w-full p-2 border border-border rounded-lg text-sm"
                  >
                    <option value="">Select skill...</option>
                    {skills.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">Day *</label>
                  <select
                    value={form.day_of_week}
                    onChange={(e) => setForm(f => ({ ...f, day_of_week: parseInt(e.target.value) }))}
                    className="w-full p-2 border border-border rounded-lg text-sm"
                  >
                    {DAY_NAMES.map((name, i) => (
                      <option key={i} value={i}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full p-2 border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">End Time *</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full p-2 border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">Min Workers</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={form.min_workers}
                    onChange={(e) => setForm(f => ({ ...f, min_workers: parseInt(e.target.value) || 1 }))}
                    className="w-full p-2 border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">Max Workers</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={form.max_workers}
                    onChange={(e) => setForm(f => ({ ...f, max_workers: e.target.value }))}
                    placeholder="No limit"
                    className="w-full p-2 border border-border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={handleAdd}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Window
                </Button>
                <Button variant="outline" onClick={() => { setIsAdding(false); setError(''); }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Templates by Day */}
        {selectedPlace && templates.length === 0 && !isAdding && (
          <Card>
            <CardContent className="text-center py-8">
              <Layers className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
              <h3 className="text-lg font-medium mb-2">No coverage windows</h3>
              <p className="text-foreground-muted mb-4">
                Add coverage windows to define how many workers you need per skill each day.
              </p>
              <Button onClick={() => {
                if (skills.length > 0) setForm(f => ({ ...f, skill_id: f.skill_id || skills[0].id }));
                setIsAdding(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Window
              </Button>
            </CardContent>
          </Card>
        )}

        {selectedPlace && templates.length > 0 && (
          <div className="space-y-4">
            {[0, 1, 2, 3, 4, 5, 6].map(day => {
              const dayTemplates = templatesByDay[day];
              if (!dayTemplates || dayTemplates.length === 0) return null;

              return (
                <Card key={day}>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-xs font-bold">
                        {DAY_SHORT[day]}
                      </span>
                      {DAY_NAMES[day]}
                      <Badge variant="default" className="text-xs ml-auto">
                        {dayTemplates.length} window{dayTemplates.length !== 1 ? 's' : ''}
                      </Badge>
                    </h3>
                    <div className="space-y-2">
                      {dayTemplates
                        .sort((a, b) => a.start_time.localeCompare(b.start_time))
                        .map(t => (
                          <div
                            key={t.id}
                            className="flex items-center gap-3 p-3 bg-background-secondary rounded-lg"
                          >
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: getSkillColor(t.skill_id) }}
                            />
                            <Badge
                              variant="info"
                              className="text-xs"
                              style={{ backgroundColor: getSkillColor(t.skill_id), color: '#fff' }}
                            >
                              {getSkillName(t.skill_id)}
                            </Badge>
                            <div className="flex items-center gap-1 text-sm text-foreground-muted">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{formatTime(t.start_time)} – {formatTime(t.end_time)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-foreground-muted">
                              <Users className="w-3.5 h-3.5" />
                              <span>
                                {t.min_workers}{t.max_workers ? `–${t.max_workers}` : '+'} workers
                              </span>
                            </div>
                            <div className="ml-auto">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(t.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Skills warning */}
        {skills.length === 0 && places.length > 0 && (
          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-warning">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm">No skills/positions defined. Create skills on the Positions page first.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
