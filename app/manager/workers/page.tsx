'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { Users, Plus, Eye, Trash2, Mail, Phone } from 'lucide-react';

interface Worker {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
}

export default function ManagerWorkersPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      const response = await fetch('/api/manager/workers', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const { workers: workersData } = await response.json();
        setWorkers(workersData || []);
      } else {
        setWorkers([]);
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
      setWorkers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveWorker = async (workerId: string) => {
    if (!confirm('Are you sure you want to remove this worker?')) return;
    
    try {
      const response = await fetch('/api/manager/workers/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workerId }),
      });
      
      if (response.ok) {
        fetchWorkers(); // Refresh the list
      }
    } catch (error) {
      console.error('Error removing worker:', error);
    }
  };

  return (
    <PageContainer
      title="Workers"
      description="Manage your team members"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Your Workers</h2>
          <Button onClick={() => router.push('/manager/workers/add')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Worker
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading workers...</div>
        ) : workers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No workers yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first team member
              </p>
              <Button onClick={() => router.push('/manager/workers/add')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Worker
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {workers.map((worker) => (
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
                        <h4 className="font-medium">
                          {worker.first_name} {worker.last_name}
                        </h4>
                        <p className="text-sm text-muted-foreground flex items-center">
                          <Mail className="w-4 h-4 mr-1" />
                          {worker.email}
                        </p>
                        {worker.phone && (
                          <p className="text-sm text-muted-foreground flex items-center">
                            <Phone className="w-4 h-4 mr-1" />
                            {worker.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={worker.is_active ? 'success' : 'warning'}>
                        {worker.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleRemoveWorker(worker.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
