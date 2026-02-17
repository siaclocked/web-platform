'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { MapPin, Users, Calendar, Building2, User, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Manager {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Place {
  id: string;
  name: string;
  address?: string;
  created_at: string;
  manager_id?: string;
  manager?: Manager;
  worker_count: number;
  active_schedule_count: number;
}

export default function CompanyPlacesPage() {
  const router = useRouter();
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPlaces();
  }, []);

  const fetchPlaces = async () => {
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
        setPlaces(data.places || []);
      }
    } catch (error) {
      console.error('Error fetching places:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaceClick = (placeId: string) => {
    router.push(`/company/places/${placeId}`);
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
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">All Places</h1>
          <p className="text-foreground-muted">
            View all work locations with their managers, workers, and schedules
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {places.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="text-center py-8">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
                <h3 className="text-lg font-medium mb-2">No places yet</h3>
                <p className="text-foreground-muted mb-4">
                  Managers haven't created any work locations yet
                </p>
              </CardContent>
            </Card>
          ) : (
            places.map((place) => (
              <Card key={place.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => handlePlaceClick(place.id)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">{place.name}</h3>
                    </div>
                    <ChevronRight className="w-5 h-5 text-foreground-muted shrink-0" />
                  </div>
                  
                  {place.address && (
                    <div className="flex items-center gap-1 text-sm text-foreground-muted mb-2">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{place.address}</span>
                    </div>
                  )}
                  
                  {place.manager && (
                    <div className="flex items-center gap-1 text-sm text-foreground-muted mb-3">
                      <User className="w-4 h-4" />
                      <span>{place.manager.first_name} {place.manager.last_name}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm pt-3 border-t border-border">
                    <div className="flex items-center gap-1 text-foreground-muted">
                      <Users className="w-4 h-4" />
                      <span>{place.worker_count}</span>
                    </div>
                    <div className="flex items-center gap-1 text-foreground-muted">
                      <Calendar className="w-4 h-4" />
                      <span>{place.active_schedule_count}</span>
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
