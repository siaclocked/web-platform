'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Input, Select } from '@/components/ui';
import { Mail, User, Phone, Building2, Briefcase, DollarSign, MapPin, X, Plus } from 'lucide-react';

interface Position {
  id: string;
  name: string;
}

interface Place {
  id: string;
  name: string;
}

export default function AddWorkerPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    hourlyRate: '',
  });
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    fetchPositions();
    fetchPlaces();
  }, []);

  const fetchPositions = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/manager/positions', {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);
      } else {
        setPositions([]);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
      setPositions([]);
    }
  };

  const fetchPlaces = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/manager/places', {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPlaces(data.places || []);
      } else {
        setPlaces([]);
      }
    } catch (error) {
      console.error('Error fetching places:', error);
      setPlaces([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  const togglePosition = (positionId: string) => {
    setSelectedPositions(prev => 
      prev.includes(positionId) 
        ? prev.filter(id => id !== positionId)
        : [...prev, positionId]
    );
  };

  const togglePlace = (placeId: string) => {
    setSelectedPlaces(prev => 
      prev.includes(placeId) 
        ? prev.filter(id => id !== placeId)
        : [...prev, placeId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/manager/workers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phone: formData.phone.trim() || null,
          positionIds: selectedPositions,
          placeIds: selectedPlaces,
          hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
        }),
      });

      const result = await response.json();

      if (!result.success || result.error) {
        throw new Error(result.error || 'Failed to create worker account');
      }

      setSuccess(true);
    } catch (err) {
      console.error('Error creating worker:', err);
      setError(err instanceof Error ? err.message : 'Failed to create worker account');
    } finally {
      setIsLoading(false);
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isFormValid = () => {
    return (
      formData.firstName.trim() &&
      formData.lastName.trim() &&
      formData.email.trim() &&
      isValidEmail(formData.email) &&
      selectedPositions.length > 0 &&
      selectedPlaces.length > 0
    );
  };

  if (success) {
    return (
      <PageContainer
        title="Success"
        description="Worker account created"
      >
        <Card>
          <CardContent className="text-center py-8">
            <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Worker Created Successfully!</h3>
            <p className="text-foreground-muted mb-6">
              {formData.email} will receive an email to set up their account
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => router.push('/manager/workers')}>
                View Workers
              </Button>
              <Button onClick={() => {
                setSuccess(false);
                setFormData({
                  firstName: '',
                  lastName: '',
                  email: '',
                  phone: '',
                  hourlyRate: '',
                });
                setSelectedPositions([]);
                setSelectedPlaces([]);
              }}>
                Add Another Worker
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Add Worker"
      description="Create a new worker account"
    >
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="John"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
              <Input
                label="Last Name"
                placeholder="Doe"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>

            <Input
              type="email"
              label="Email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Input
              type="tel"
              label="Phone (Optional)"
              placeholder="+1 (555) 123-4567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            {/* Positions Multi-Select */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Positions <span className="text-danger">*</span>
              </label>
              {isLoadingData ? (
                <p className="text-sm text-foreground-muted">Loading positions...</p>
              ) : positions.length === 0 ? (
                <p className="text-sm text-warning">No positions available. Please add positions first.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {positions.map(position => (
                    <button
                      key={position.id}
                      type="button"
                      onClick={() => togglePosition(position.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        selectedPositions.includes(position.id)
                          ? 'bg-primary text-white'
                          : 'bg-background-secondary text-foreground hover:bg-background-tertiary'
                      }`}
                    >
                      <Briefcase className="w-3 h-3 inline mr-1" />
                      {position.name}
                    </button>
                  ))}
                </div>
              )}
              {selectedPositions.length > 0 && (
                <p className="text-xs text-foreground-muted mt-1">
                  {selectedPositions.length} position(s) selected
                </p>
              )}
            </div>

            {/* Places Multi-Select */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Work Locations <span className="text-danger">*</span>
              </label>
              {isLoadingData ? (
                <p className="text-sm text-foreground-muted">Loading places...</p>
              ) : places.length === 0 ? (
                <p className="text-sm text-warning">No places available. Please add places first.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {places.map(place => (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => togglePlace(place.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        selectedPlaces.includes(place.id)
                          ? 'bg-accent text-white'
                          : 'bg-background-secondary text-foreground hover:bg-background-tertiary'
                      }`}
                    >
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {place.name}
                    </button>
                  ))}
                </div>
              )}
              {selectedPlaces.length > 0 && (
                <p className="text-xs text-foreground-muted mt-1">
                  {selectedPlaces.length} location(s) selected
                </p>
              )}
            </div>

            <Input
              type="number"
              step="0.01"
              label="Hourly Rate (Optional)"
              placeholder="15.00"
              value={formData.hourlyRate}
              onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
            />

            {error && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={!isFormValid()}
            >
              Create Worker Account
            </Button>
          </form>

          <p className="text-center text-xs text-foreground-muted mt-6">
            By creating this account, the worker will receive an email to log in
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
