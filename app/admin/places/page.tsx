'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { MapPin, Users, Calendar, ChevronRight, Building2, Mail, Phone, Clock, User } from 'lucide-react';

interface Manager {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
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

interface Position {
  id: string;
  name: string;
  color: string;
}

interface Worker {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  hourly_rate?: number;
  is_active: boolean;
  positions: Position[];
}

interface Schedule {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  availability_deadline: string;
  created_at: string;
  manager?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  shift_count: number;
  submission_count: number;
}

interface PlaceDetails {
  place: Place;
  workers: Worker[];
  schedules: Schedule[];
}

export default function AdminPlacesPage() {
  const router = useRouter();
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    fetchPlaces();
  }, []);

  const fetchPlaces = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/admin/places', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPlaces(data.places || []);
      } else {
        console.error('Failed to fetch places');
      }
    } catch (error) {
      console.error('Error fetching places:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlaceDetails = async (placeId: string) => {
    setIsLoadingDetails(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/admin/places/${placeId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedPlace(data);
      } else {
        console.error('Failed to fetch place details');
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handlePlaceClick = (place: Place) => {
    fetchPlaceDetails(place.id);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="text-foreground-muted">Loading places...</div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Company Places Overview</h1>
        <p className="text-foreground-muted">View all places, their managers, workers, and active schedules</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Places List */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">All Places ({places.length})</h2>
          <div className="space-y-3">
            {places.map((place) => (
              <Card
                key={place.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedPlace?.place.id === place.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => handlePlaceClick(place)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">{place.name}</h3>
                      </div>
                      {place.address && (
                        <div className="flex items-center gap-1 text-sm text-foreground-muted mb-2">
                          <MapPin className="w-4 h-4" />
                          <span>{place.address}</span>
                        </div>
                      )}
                      {place.manager && (
                        <div className="flex items-center gap-1 text-sm text-foreground-muted mb-2">
                          <User className="w-4 h-4" />
                          <span>Manager: {place.manager.first_name} {place.manager.last_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-foreground-muted">
                          <Users className="w-4 h-4" />
                          <span>{place.worker_count} workers</span>
                        </div>
                        <div className="flex items-center gap-1 text-foreground-muted">
                          <Calendar className="w-4 h-4" />
                          <span>{place.active_schedule_count} schedules</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-foreground-muted shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
            {places.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-foreground-muted">
                  No places found
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Place Details */}
        <div>
          {selectedPlace ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Place Details</h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPlace(null)}>
                  Close
                </Button>
              </div>

              {isLoadingDetails ? (
                <Card>
                  <CardContent className="p-8 text-center text-foreground-muted">
                    Loading details...
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Manager Info */}
                  {selectedPlace.place.manager && (
                    <Card>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                          <User className="w-5 h-5 text-primary" />
                          Place Manager
                        </h3>
                        <div className="space-y-2">
                          <div className="text-foreground">
                            {selectedPlace.place.manager.first_name} {selectedPlace.place.manager.last_name}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-foreground-muted">
                            <Mail className="w-4 h-4" />
                            <span>{selectedPlace.place.manager.email}</span>
                          </div>
                          {selectedPlace.place.manager.phone && (
                            <div className="flex items-center gap-2 text-sm text-foreground-muted">
                              <Phone className="w-4 h-4" />
                              <span>{selectedPlace.place.manager.phone}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Workers */}
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        Workers ({selectedPlace.workers.length})
                      </h3>
                      <div className="space-y-3">
                        {selectedPlace.workers.map((worker) => (
                          <div key={worker.id} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="font-medium text-foreground">
                                  {worker.first_name} {worker.last_name}
                                </div>
                                <div className="text-sm text-foreground-muted">{worker.email}</div>
                              </div>
                              {worker.hourly_rate && (
                                <div className="text-sm font-medium text-foreground">
                                  ${worker.hourly_rate}/hr
                                </div>
                              )}
                            </div>
                            {worker.positions.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {worker.positions.map((position) => (
                                  <Badge
                                    key={position.id}
                                    variant="default"
                                    style={{ backgroundColor: position.color }}
                                  >
                                    {position.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {selectedPlace.workers.length === 0 && (
                          <div className="text-sm text-foreground-muted text-center py-4">
                            No workers assigned to this place
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Active Schedules */}
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        Active Schedules ({selectedPlace.schedules.length})
                      </h3>
                      <div className="space-y-3">
                        {selectedPlace.schedules.map((schedule) => (
                          <div key={schedule.id} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="font-medium text-foreground mb-1">{schedule.name}</div>
                                <div className="text-sm text-foreground-muted mb-1">
                                  {formatDate(schedule.start_date)} - {formatDate(schedule.end_date)}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-foreground-muted">
                                  <Clock className="w-3 h-3" />
                                  <span>Deadline: {formatDate(schedule.availability_deadline)}</span>
                                </div>
                              </div>
                              <Badge variant={schedule.status === 'published' ? 'success' : 'default'}>
                                {schedule.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-foreground-muted">
                              <span>{schedule.shift_count} shifts</span>
                              <span>{schedule.submission_count} submissions</span>
                            </div>
                          </div>
                        ))}
                        {selectedPlace.schedules.length === 0 && (
                          <div className="text-sm text-foreground-muted text-center py-4">
                            No active schedules for this place
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-foreground-muted">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a place to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
