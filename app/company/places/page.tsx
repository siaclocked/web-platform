'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { BackButton } from '@/components/ui';
import { MapPin, Users, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Manager {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  places: Place[];
  total_places: number;
  total_workers: number;
}

interface Place {
  id: string;
  name: string;
  address?: string;
  description?: string;
  created_at: string;
  worker_count: number;
}

export default function CompanyPlacesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);

  useEffect(() => {
    fetchManagers();
  }, []);

  useEffect(() => {
    const managerId = searchParams.get('manager');
    if (managerId && managers.length > 0) {
      const manager = managers.find(m => m.id === managerId);
      if (manager) {
        setSelectedManager(manager);
      }
    }
  }, [searchParams, managers]);

  const fetchManagers = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/company/places', {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setManagers(data.managers || []);
      }
    } catch (error) {
      console.error('Error fetching managers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManagerClick = (manager: Manager) => {
    setSelectedManager(manager);
  };

  const handlePlaceClick = (placeId: string) => {
    if (!selectedManager) return;
    router.push(`/company/places/${placeId}?manager=${selectedManager.id}`);
  };

  const handleBack = () => {
    setSelectedManager(null);
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

  if (selectedManager) {
    return (
      <PageContainer>
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button variant="outline" onClick={handleBack} className="mb-4">
          ← Back to Managers
        </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {selectedManager.first_name} {selectedManager.last_name}'s Places
                </h1>
                <p className="text-foreground-muted">
                  {selectedManager.email}
                </p>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{selectedManager.total_places}</div>
                  <div className="text-sm text-muted-foreground">Places</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{selectedManager.total_workers}</div>
                  <div className="text-sm text-muted-foreground">Workers</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {selectedManager.places.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No places yet</h3>
                  <p className="text-muted-foreground">
                    This manager hasn't created any work locations
                  </p>
                </CardContent>
              </Card>
            ) : (
              selectedManager.places.map((place) => (
                <Card key={place.id} className="cursor-pointer hover:bg-background-tertiary transition-colors">
                  <CardContent className="p-4" onClick={() => handlePlaceClick(place.id)}>
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
                        {place.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {place.description}
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
                        <Button variant="outline" size="sm">
                          View Workers
                          <ArrowRight className="w-4 h-4 ml-1" />
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

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton href="/company" label="Back to Dashboard" className="mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Places</h1>
          <p className="text-foreground-muted">
            View all work locations managed by your team
          </p>
        </div>

        <div className="space-y-4">
          {managers.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No managers yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add managers to see their work locations
                </p>
                <Button onClick={() => router.push('/company/managers/add')}>
                  Add Manager
                </Button>
              </CardContent>
            </Card>
          ) : (
            managers.map((manager) => (
              <Card key={manager.id} className="cursor-pointer hover:bg-background-tertiary transition-colors">
                <CardContent className="p-4" onClick={() => handleManagerClick(manager)}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground mb-1">
                        {manager.first_name} {manager.last_name}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {manager.email}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{manager.total_places} places</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{manager.total_workers} workers</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={manager.total_places > 0 ? 'success' : 'warning'}>
                        {manager.total_places > 0 ? 'Active' : 'No Places'}
                      </Badge>
                      <Button variant="outline" size="sm">
                        View Places
                        <ArrowRight className="w-4 h-4 ml-1" />
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
