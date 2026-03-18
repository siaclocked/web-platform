'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { MapPin, Users, Mail, Phone, Briefcase } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Place {
  id: string;
  name: string;
  address?: string;
  created_at: string;
  worker_count: number;
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
  is_active: boolean;
  hourly_rate?: number;
  positions?: Position[];
  created_at: string;
}

export default function CompanyPlaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [place, setPlace] = useState<Place | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params;
      setResolvedParams(resolved);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    const manager = searchParams.get('manager');
    if (manager) {
      setManagerId(manager);
    }
  }, [searchParams]);

  useEffect(() => {
    if (resolvedParams) {
      fetchPlaceDetails();
    }
  }, [resolvedParams?.id]);

  const fetchPlaceDetails = async () => {
    if (!resolvedParams) return;
    
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/company/places/${resolvedParams.id}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPlace(data.place);
        setWorkers(data.workers || []);
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    } finally {
      setIsLoading(false);
    }
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

  if (!place) {
    return (
      <PageContainer>
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-8">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Place not found</h3>
              <p className="text-muted-foreground">
                The requested work location could not be found
              </p>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{place.name}</h1>
              {place.address && (
                <p className="text-foreground-muted">{place.address}</p>
              )}
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{place.worker_count}</div>
                <div className="text-sm text-muted-foreground">Workers</div>
              </div>
            </div>
          </div>
                  </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Workers at this Location</h2>
            <Badge variant="default">
              {workers.length} total
            </Badge>
          </div>

          {workers.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No workers assigned</h3>
                <p className="text-muted-foreground">
                  No workers are currently assigned to this location
                </p>
              </CardContent>
            </Card>
          ) : (
            workers.map((worker) => (
              <Card key={worker.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {worker.first_name[0]}{worker.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">
                          {worker.first_name} {worker.last_name}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            <span>{worker.email}</span>
                          </div>
                          {worker.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              <span>{worker.phone}</span>
                            </div>
                          )}
                        </div>
                        {worker.positions && worker.positions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {worker.positions.map((pos) => (
                              <Badge key={pos.id} variant="default" style={{ backgroundColor: pos.color }}>
                                {pos.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={worker.is_active ? 'success' : 'warning'}>
                        {worker.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {worker.hourly_rate && (
                        <Badge variant="info">
                          ${worker.hourly_rate}/hr
                        </Badge>
                      )}
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
