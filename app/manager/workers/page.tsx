'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge, Input, Select } from '@/components/ui';
import { Users, Plus, Edit2, Trash2, Mail, Phone } from 'lucide-react';

interface Worker {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  position_id?: string;
  hourly_rate?: number;
  position_name?: string;
}

interface Position {
  id: string;
  name: string;
}

export default function ManagerWorkersPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [positions, setPositions] = useState<Position[]>([]);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [editForm, setEditForm] = useState({
    position_id: '',
    hourly_rate: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchWorkers();
    fetchPositions();
  }, []);

  const fetchWorkers = async () => {
    try {
      // Get auth token
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/manager/workers', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
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
      // Get auth token
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/manager/workers/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
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
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  };

  const handleEditWorker = (worker: Worker) => {
    setEditingWorker(worker);
    setEditForm({
      position_id: worker.position_id || '',
      hourly_rate: worker.hourly_rate ? worker.hourly_rate.toString() : '',
    });
    setError('');
    setSuccess('');
  };

  const handleUpdateWorker = async () => {
    if (!editingWorker) return;
    
    setIsUpdating(true);
    setError('');
    setSuccess('');

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const updateData = {
        workerId: editingWorker.id,
        position_id: editForm.position_id && editForm.position_id !== '' ? editForm.position_id : null,
        hourly_rate: editForm.hourly_rate ? parseFloat(editForm.hourly_rate) : null,
      };
      
      const response = await fetch('/api/manager/workers/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        setSuccess('Worker updated successfully!');
        fetchWorkers(); // Refresh the list
        setTimeout(() => {
          setEditingWorker(null);
          setSuccess('');
        }, 2000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update worker');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update worker');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingWorker(null);
    setEditForm({ position_id: '', hourly_rate: '' });
    setError('');
    setSuccess('');
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

        {/* Edit Worker Modal */}
        {editingWorker && (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Edit Worker: {editingWorker.first_name} {editingWorker.last_name}
              </h3>
              
              <div className="space-y-4">
                <Select
                  label="Position"
                  value={editForm.position_id}
                  onChange={(e) => setEditForm({ ...editForm, position_id: e.target.value })}
                  placeholder="Select a position"
                  options={[
                    { value: '', label: '-- No Position --' },
                    ...positions.map(position => ({
                      value: position.id,
                      label: position.name
                    }))
                  ]}
                />

                <Input
                  type="number"
                  step="0.01"
                  label="Hourly Rate"
                  placeholder="15.00"
                  value={editForm.hourly_rate}
                  onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })}
                />

                {error && (
                  <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                    <p className="text-sm text-danger">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                    <p className="text-sm text-success">{success}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button 
                    onClick={handleUpdateWorker}
                    disabled={isUpdating}
                    isLoading={isUpdating}
                  >
                    Update Worker
                  </Button>
                  <Button variant="outline" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                        <div className="flex items-center gap-3 mt-1">
                          {worker.position_name && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              {worker.position_name}
                            </span>
                          )}
                          {worker.hourly_rate && (
                            <span className="text-xs bg-success/10 text-success px-2 py-1 rounded">
                              ${worker.hourly_rate}/hr
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={worker.is_active ? 'success' : 'warning'}>
                        {worker.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditWorker(worker)}
                      >
                        <Edit2 className="w-4 h-4" />
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
