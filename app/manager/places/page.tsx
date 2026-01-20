'use client';

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Input, Badge } from '@/components/ui';
import { BackButton } from '@/components/ui';
import { MapPin, Plus, Edit2, Trash2, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Place {
  id: string;
  name: string;
  address?: string;
  created_at: string;
  worker_count?: number;
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

  useEffect(() => {
    fetchPlaces();
  }, []);

  const fetchPlaces = async () => {
    try {
      // Get auth token
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
      }
    } catch (error) {
      console.error('Error fetching places:', error);
    } finally {
      setIsLoading(false);
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
      // Get auth token
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const url = editingPlace 
        ? `/api/manager/places/${editingPlace.id}`
        : '/api/manager/places';
      
      const method = editingPlace ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
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

  const handleDelete = async (placeId: string) => {
    if (!confirm('Are you sure you want to delete this place?')) {
      return;
    }

    try {
      // Get auth token
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/manager/places/${placeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
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
          <BackButton href="/manager" label="Back to Dashboard" className="mb-4" />
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

        {/* Places List */}
        <div className="space-y-4">
          {places.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No places yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first work location to get started
                </p>
                <Button onClick={() => setIsAddingPlace(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Place
                </Button>
              </CardContent>
            </Card>
          ) : (
            places.map((place) => (
              <Card key={place.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground mb-1">
                        {place.name}
                      </h3>
                      {place.address && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {place.address}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{place.worker_count || 0} workers</span>
                        </div>
                        <span>
                          Created {new Date(place.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </PageContainer>
  );
}
