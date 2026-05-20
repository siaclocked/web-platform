'use client';

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Input, Toggle } from '@/components/ui';

import { MapPin, Plus, Edit2, Trash2, Users, Settings, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { authedFetch } from '@/lib/api';

interface PlaceSettings {
  min_hours_per_block: number;
  max_hours_per_block: number;
  min_rest_between_shifts: number;
  schedule_granularity_minutes: number;
  grace_period_minutes: number;
}

const DEFAULT_SETTINGS: PlaceSettings = {
  min_hours_per_block: 2,
  max_hours_per_block: 10,
  min_rest_between_shifts: 8,
  schedule_granularity_minutes: 15,
  grace_period_minutes: 15,
};

interface Worker {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  positions?: string[];
}

interface Place {
  id: string;
  name: string;
  address?: string;
  settings?: PlaceSettings;
  created_at: string;
  worker_count?: number;
  workers?: Worker[];
}

interface PlaceSkillRule {
  skill_id: string;
  skill_name: string;
  enforce_min_team_rating: boolean;
  min_avg_rating: number | null;
}

export default function ManagerPlacesPage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settingsForm, setSettingsForm] = useState<PlaceSettings>(DEFAULT_SETTINGS);
  const [expandedSettings, setExpandedSettings] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingSkillRules, setSavingSkillRules] = useState(false);
  // Per-place save outcome — drives the Save button's variant + label for 2s after a save.
  const [saveResult, setSaveResult] = useState<Record<string, 'success' | 'error' | null>>({});
  const [saveError, setSaveError] = useState<Record<string, string>>({});
  const [expandedWorkers, setExpandedWorkers] = useState<string | null>(null);
  const [loadingWorkers, setLoadingWorkers] = useState<string | null>(null);
  const [skillRules, setSkillRules] = useState<PlaceSkillRule[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPlaces();
  }, []);

  const fetchPlaces = async () => {
    try {
      const response = await authedFetch('/api/manager/places');

      if (response.ok) {
        const data = await response.json();
        setPlaces(data.places || []);
      }
    } catch (error) {
      console.error('Error fetching places:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWorkersForPlace = async (placeId: string) => {
    setLoadingWorkers(placeId);
    try {
      const response = await authedFetch(`/api/manager/places/${placeId}/workers`);

      if (response.ok) {
        const data = await response.json();
        setPlaces(prev => prev.map(p =>
          p.id === placeId ? { ...p, workers: data.workers || [] } : p
        ));
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setLoadingWorkers(null);
    }
  };

  const toggleWorkers = async (placeId: string) => {
    if (expandedWorkers === placeId) {
      setExpandedWorkers(null);
    } else {
      setExpandedWorkers(placeId);
      const place = places.find(p => p.id === placeId);
      if (!place?.workers) {
        await fetchWorkersForPlace(placeId);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError('Place name is required');
      return;
    }

    try {
      const url = editingPlace
        ? `/api/manager/places/${editingPlace.id}`
        : '/api/manager/places';

      const method = editingPlace ? 'PUT' : 'POST';

      const response = await authedFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          address: formData.address?.trim() || null,
        }),
      });

      if (response.ok) {
        setSuccess(editingPlace ? 'Place updated successfully!' : 'Place added successfully!');
        setFormData({ name: '', address: '' });
        setIsAddingPlace(false);
        setEditingPlace(null);
        fetchPlaces();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save place');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save place');
    }
  };

  const handleEdit = (place: Place) => {
    setEditingPlace(place);
    setFormData({
      name: place.name,
      address: place.address || '',
    });
    setIsAddingPlace(true);
  };

  const fetchSkillRules = async (placeId: string) => {
    try {
      const response = await authedFetch(`/api/manager/places/${placeId}/skill-configs`);

      if (response.ok) {
        const data = await response.json();
        setSkillRules(data.skill_configs || []);
      } else {
        setSkillRules([]);
      }
    } catch (err) {
      console.error('Error loading skill rules:', err);
      setSkillRules([]);
    }
  };

  const toggleSettings = async (placeId: string) => {
    if (expandedSettings === placeId) {
      setExpandedSettings(null);
      setSkillRules([]);
    } else {
      const place = places.find(p => p.id === placeId);
      setSettingsForm({ ...DEFAULT_SETTINGS, ...(place?.settings || {}) });
      setExpandedSettings(placeId);
      await fetchSkillRules(placeId);
    }
  };

  const saveSettings = async (placeId: string) => {
    setSavingSettings(true);
    setSavingSkillRules(true);
    setError('');
    setSaveResult(s => ({ ...s, [placeId]: null }));
    setSaveError(s => ({ ...s, [placeId]: '' }));
    let outcome: 'success' | 'error' = 'error';
    try {
      const place = places.find(p => p.id === placeId);
      if (!place) return;

      const response = await authedFetch(`/api/manager/places/${placeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: place.name,
          address: place.address || null,
          settings: settingsForm,
        }),
      });

      if (response.ok) {
        const rulesResponse = await authedFetch(`/api/manager/places/${placeId}/skill-configs`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            skill_configs: skillRules.map((r) => ({
              skill_id: r.skill_id,
              enforce_min_team_rating: r.enforce_min_team_rating,
              min_avg_rating: r.min_avg_rating,
            })),
          }),
        });

        if (!rulesResponse.ok) {
          const rulesErrorData = await rulesResponse.json();
          throw new Error(rulesErrorData.error || 'Failed to save skill rules');
        }

        setSuccess('Settings and skill rules saved!');
        setSaveResult(s => ({ ...s, [placeId]: 'success' }));
        outcome = 'success';
        await fetchPlaces();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      setError(msg);
      setSaveResult(s => ({ ...s, [placeId]: 'error' }));
      setSaveError(s => ({ ...s, [placeId]: msg }));
    } finally {
      setSavingSettings(false);
      setSavingSkillRules(false);
      // Auto-reset the button state after 2.5s so the next save starts fresh.
      // On success, also collapse the settings panel (only if this place's panel is still the one open).
      setTimeout(() => {
        setSaveResult(s => ({ ...s, [placeId]: null }));
        setSaveError(s => ({ ...s, [placeId]: '' }));
        if (outcome === 'success') {
          setExpandedSettings(current => (current === placeId ? null : current));
        }
      }, 2500);
    }
  };

  const setSkillRuleEnforcement = (skillId: string, enforce: boolean) => {
    setSkillRules((prev) =>
      prev.map((rule) =>
        rule.skill_id === skillId
          ? {
              ...rule,
              enforce_min_team_rating: enforce,
              min_avg_rating: enforce ? (rule.min_avg_rating ?? 5) : null,
            }
          : rule
      )
    );
  };

  const setSkillRuleMinAvg = (skillId: string, value: string) => {
    const parsed = value === '' ? null : Number(value);
    setSkillRules((prev) =>
      prev.map((rule) =>
        rule.skill_id === skillId
          ? { ...rule, min_avg_rating: parsed !== null && !Number.isNaN(parsed) ? parsed : null }
          : rule
      )
    );
  };

  const handleDelete = async (placeId: string) => {
    if (!confirm('Are you sure you want to delete this place?')) {
      return;
    }

    try {
      const response = await authedFetch(`/api/manager/places/${placeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccess('Place deleted successfully!');
        fetchPlaces();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete place');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete place');
    }
  };

  const handleCancel = () => {
    setIsAddingPlace(false);
    setEditingPlace(null);
    setFormData({ name: '', address: '' });
    setError('');
    setSuccess('');
  };

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
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Places</h1>
            <Button
              onClick={() => setIsAddingPlace(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Place
            </Button>
          </div>
          <p className="text-foreground-muted">
            Manage work locations for your workers
          </p>
        </div>

        {/* Add/Edit Place Form */}
        {isAddingPlace && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingPlace ? 'Edit Place' : 'Add New Place'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Place Name *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Downtown Restaurant, Main Office"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Address
                  </label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Main St, City, State"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-danger-muted/20 border border-danger/30 rounded-lg">
                    <p className="text-sm text-danger">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="p-3 bg-success-muted/20 border border-success/30 rounded-lg">
                    <p className="text-sm text-success">{success}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button type="submit" isLoading={false}>
                    {editingPlace ? 'Update Place' : 'Add Place'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted w-4 h-4" />
            <Input
              type="text"
              placeholder="Search places..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Places List */}
        <div className="space-y-4">
          {places.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <MapPin className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
                <h3 className="text-lg font-medium mb-2">No places yet</h3>
                <p className="text-foreground-muted mb-4">
                  Add your first work location to get started
                </p>
                <Button onClick={() => setIsAddingPlace(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Place
                </Button>
              </CardContent>
            </Card>
          ) : (
            places.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.address || '').toLowerCase().includes(searchTerm.toLowerCase())).map((place) => (
              <Card key={place.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground mb-1">
                        {place.name}
                      </h3>
                      {place.address && (
                        <p className="text-sm text-foreground-muted mb-2">
                          {place.address}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-foreground-muted">
                        <button
                          onClick={() => toggleWorkers(place.id)}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          <Users className="w-4 h-4" />
                          <span>{place.worker_count || 0} workers</span>
                          {expandedWorkers === place.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <span>
                          Created {new Date(place.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSettings(place.id)}
                        title="Scheduling Settings"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(place)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(place.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Workers List */}
                  {expandedWorkers === place.id && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Workers at this location
                      </h4>
                      {loadingWorkers === place.id ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                        </div>
                      ) : place.workers && place.workers.length > 0 ? (
                        <div className="space-y-2">
                          {place.workers.map((worker) => (
                            <div key={worker.id} className="flex items-center justify-between p-2 bg-background-secondary rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {worker.first_name} {worker.last_name}
                                </p>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-foreground-muted">{worker.email}</p>
                                  {worker.positions && worker.positions.length > 0 && (
                                    <span className="text-xs text-primary font-medium">
                                      · {worker.positions.join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-foreground-muted py-2">No team members assigned to this place yet</p>
                      )}
                    </div>
                  )}

                  {expandedSettings === place.id && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Scheduling Settings
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-foreground-muted mb-1">
                            Min Hours Per Shift
                          </label>
                          <input
                            type="number"
                            min="0.5"
                            max="12"
                            step="0.5"
                            value={settingsForm.min_hours_per_block}
                            onChange={(e) => setSettingsForm(s => ({ ...s, min_hours_per_block: Number(e.target.value) }))}
                            className="w-full p-2 border border-border rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-foreground-muted mb-1">
                            Max Hours Per Shift
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="16"
                            step="0.5"
                            value={settingsForm.max_hours_per_block}
                            onChange={(e) => setSettingsForm(s => ({ ...s, max_hours_per_block: Number(e.target.value) }))}
                            className="w-full p-2 border border-border rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-foreground-muted mb-1">
                            Min Rest Between Shifts (hrs)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="24"
                            value={settingsForm.min_rest_between_shifts}
                            onChange={(e) => setSettingsForm(s => ({ ...s, min_rest_between_shifts: Number(e.target.value) }))}
                            className="w-full p-2 border border-border rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-foreground-muted mb-1">
                            Schedule Granularity (min)
                          </label>
                          <select
                            value={settingsForm.schedule_granularity_minutes}
                            onChange={(e) => setSettingsForm(s => ({ ...s, schedule_granularity_minutes: Number(e.target.value) }))}
                            className="w-full p-2 border border-border rounded-lg text-sm"
                          >
                            <option value={5}>5 minutes</option>
                            <option value={10}>10 minutes</option>
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={60}>60 minutes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-foreground-muted mb-1">
                            Clock-In Grace Period (min)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="60"
                            value={settingsForm.grace_period_minutes}
                            onChange={(e) => setSettingsForm(s => ({ ...s, grace_period_minutes: Number(e.target.value) }))}
                            className="w-full p-2 border border-border rounded-lg text-sm"
                          />
                        </div>
                      </div>
                      <div className="mt-5 border-t border-border pt-4">
                        <h5 className="text-xs font-semibold text-foreground mb-3">Skill Mix Rules</h5>
                        {skillRules.length === 0 ? (
                          <p className="text-xs text-foreground-muted">No skills configured yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {skillRules.map((rule) => (
                              <div key={rule.skill_id} className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg border border-border p-3">
                                <div className="text-sm font-medium text-foreground">{rule.skill_name}</div>
                                <div>
                                  <Toggle
                                    checked={rule.enforce_min_team_rating}
                                    onChange={(checked) => setSkillRuleEnforcement(rule.skill_id, checked)}
                                    label="Enforce min team rating"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-foreground-muted mb-1">
                                    Min Average Rating
                                  </label>
                                  <input
                                    type="number"
                                    min="0.1"
                                    max="10"
                                    step="0.1"
                                    disabled={!rule.enforce_min_team_rating}
                                    value={rule.min_avg_rating ?? ''}
                                    onChange={(e) => setSkillRuleMinAvg(rule.skill_id, e.target.value)}
                                    className="w-full p-2 border border-border rounded-lg text-sm disabled:opacity-50"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        {(() => {
                          const result = saveResult[place.id] ?? null;
                          const variant = result === 'success' ? 'success' : result === 'error' ? 'danger' : 'primary';
                          const label = result === 'success' ? 'Saved!' : result === 'error' ? 'Save failed — retry' : 'Save Settings & Rules';
                          return (
                            <Button
                              size="sm"
                              variant={variant}
                              onClick={() => saveSettings(place.id)}
                              isLoading={(savingSettings || savingSkillRules) && expandedSettings === place.id}
                            >
                              {label}
                            </Button>
                          );
                        })()}
                        <Button size="sm" variant="outline" onClick={() => setExpandedSettings(null)}>
                          Cancel
                        </Button>
                        {saveResult[place.id] === 'error' && saveError[place.id] && (
                          <span className="text-xs text-danger">{saveError[place.id]}</span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </PageContainer>
  );
}
