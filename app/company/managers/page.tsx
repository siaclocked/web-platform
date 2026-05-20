'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge, Input } from '@/components/ui';
import { Users, Plus, Eye, Trash2, Mail, Phone, Search, MapPin, ChevronLeft, Edit2, Save, X } from 'lucide-react';

interface Manager {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  companies: {
    name: string;
  };
}

interface ManagerPlace {
  id: string;
  name: string;
  address?: string;
  worker_count: number;
}

interface ManagerWorker {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  hourly_rate?: number;
  place_names: string[];
}

interface ManagerDetails {
  manager: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    is_active: boolean;
    created_at: string;
  };
  places: ManagerPlace[];
  workers: ManagerWorker[];
}

export default function CompanyManagersPage() {
  const router = useRouter();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [filteredManagers, setFilteredManagers] = useState<Manager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedManager, setSelectedManager] = useState<ManagerDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isEditingManager, setIsEditingManager] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', phone: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchManagers();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredManagers(managers);
    } else {
      const searchLower = searchTerm.toLowerCase();
      const filtered = managers.filter(manager => 
        manager.first_name.toLowerCase().includes(searchLower) ||
        manager.last_name.toLowerCase().includes(searchLower) ||
        manager.email.toLowerCase().includes(searchLower) ||
        `${manager.first_name} ${manager.last_name}`.toLowerCase().includes(searchLower) ||
        `${manager.last_name} ${manager.first_name}`.toLowerCase().includes(searchLower)
      );
      setFilteredManagers(filtered);
    }
  }, [searchTerm, managers]);

  const getToken = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const fetchManagers = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/company/managers', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const { managers: managersData } = await response.json();
        setManagers(managersData || []);
        setFilteredManagers(managersData || []);
      } else {
        setManagers([]);
        setFilteredManagers([]);
      }
    } catch (error) {
      console.error('Error fetching managers:', error);
      setManagers([]);
      setFilteredManagers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchManagerDetails = async (managerId: string) => {
    setIsLoadingDetails(true);
    try {
      const token = await getToken();
      const response = await fetch(`/api/company/managers/${managerId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data: ManagerDetails = await response.json();
        setSelectedManager(data);
        setEditForm({
          first_name: data.manager.first_name,
          last_name: data.manager.last_name,
          email: data.manager.email,
          phone: data.manager.phone || '',
        });
      }
    } catch (error) {
      console.error('Error fetching manager details:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedManager) return;
    setIsSaving(true);
    try {
      const token = await getToken();
      const response = await fetch(`/api/company/managers/${selectedManager.manager.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        setIsEditingManager(false);
        await fetchManagerDetails(selectedManager.manager.id);
        await fetchManagers();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to update');
      }
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveManager = async (managerId: string) => {
    if (!confirm('Are you sure you want to remove this manager?')) return;
    
    try {
      const response = await fetch('/api/company/managers/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId }),
      });
      
      if (response.ok) {
        if (selectedManager?.manager.id === managerId) {
          setSelectedManager(null);
        }
        fetchManagers();
      }
    } catch (error) {
      console.error('Error removing manager:', error);
    }
  };

  // Detail view for a selected manager
  if (selectedManager) {
    const mgr = selectedManager.manager;
    return (
      <PageContainer title="Manager Details" description="View and edit manager information">
        <div className="space-y-6">
          <Button variant="outline" size="sm" onClick={() => { setSelectedManager(null); setIsEditingManager(false); }}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Managers
          </Button>

          {isLoadingDetails ? (
            <Card>
              <CardContent className="p-8 text-center text-foreground-muted">Loading details...</CardContent>
            </Card>
          ) : (
            <>
              {/* Manager Info */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-lg">
                          {mgr.first_name[0]}{mgr.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-foreground">{mgr.first_name} {mgr.last_name}</h2>
                        <p className="text-sm text-foreground-muted">Manager</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={mgr.is_active ? 'success' : 'warning'}>
                        {mgr.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {!isEditingManager && (
                        <Button variant="outline" size="sm" onClick={() => setIsEditingManager(true)}>
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>

                  {isEditingManager ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-foreground-muted mb-1">First Name</label>
                          <input
                            type="text"
                            value={editForm.first_name}
                            onChange={(e) => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                            className="w-full p-2 border border-border rounded-lg text-sm bg-background text-foreground"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-foreground-muted mb-1">Last Name</label>
                          <input
                            type="text"
                            value={editForm.last_name}
                            onChange={(e) => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                            className="w-full p-2 border border-border rounded-lg text-sm bg-background text-foreground"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-foreground-muted mb-1">Email</label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                          className="w-full p-2 border border-border rounded-lg text-sm bg-background text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-foreground-muted mb-1">Phone</label>
                        <input
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                          className="w-full p-2 border border-border rounded-lg text-sm bg-background text-foreground"
                          placeholder="Optional"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={handleSaveEdit} isLoading={isSaving}>
                          <Save className="w-4 h-4 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setIsEditingManager(false);
                          setEditForm({
                            first_name: mgr.first_name,
                            last_name: mgr.last_name,
                            email: mgr.email,
                            phone: mgr.phone || '',
                          });
                        }}>
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-foreground-muted">
                        <Mail className="w-4 h-4" />
                        <span>{mgr.email}</span>
                      </div>
                      {mgr.phone && (
                        <div className="flex items-center gap-2 text-foreground-muted">
                          <Phone className="w-4 h-4" />
                          <span>{mgr.phone}</span>
                        </div>
                      )}
                      <div className="text-xs text-foreground-muted pt-2">
                        Joined {new Date(mgr.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Places Managed */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Places Managed ({selectedManager.places.length})
                  </h3>
                  {selectedManager.places.length === 0 ? (
                    <p className="text-sm text-foreground-muted text-center py-4">No places assigned</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedManager.places.map((place) => (
                        <div key={place.id} className="flex items-center justify-between p-3 bg-background-secondary rounded-lg">
                          <div>
                            <div className="font-medium text-foreground">{place.name}</div>
                            {place.address && (
                              <div className="text-xs text-foreground-muted">{place.address}</div>
                            )}
                          </div>
                          <Badge variant="default">{place.worker_count} workers</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Workers Managed */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Team Members ({selectedManager.workers.length})
                  </h3>
                  {selectedManager.workers.length === 0 ? (
                    <p className="text-sm text-foreground-muted text-center py-4">No team members under this manager</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedManager.workers.map((worker) => (
                        <div key={worker.id} className="flex items-center justify-between p-3 bg-background-secondary rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-foreground-muted/20 rounded-full flex items-center justify-center text-xs font-medium text-foreground">
                              {worker.first_name[0]}{worker.last_name[0]}
                            </div>
                            <div>
                              <div className="font-medium text-foreground text-sm">{worker.first_name} {worker.last_name}</div>
                              <div className="text-xs text-foreground-muted">{worker.email}</div>
                              {worker.place_names.length > 0 && (
                                <div className="text-xs text-foreground-muted flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3" />
                                  {worker.place_names.join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={worker.is_active ? 'success' : 'warning'}>
                              {worker.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            {worker.hourly_rate && (
                              <span className="text-xs text-foreground-muted">${worker.hourly_rate}/hr</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Managers"
      description="Manage your company managers"
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-semibold">Your Managers</h2>
          <Button onClick={() => router.push('/company/managers/add')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Manager
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted w-4 h-4" />
          <Input
            type="text"
            placeholder="Search managers by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading managers...</div>
        ) : filteredManagers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
              <h3 className="text-lg font-medium mb-2">
                {searchTerm ? 'No managers found' : 'No managers yet'}
              </h3>
              <p className="text-foreground-muted mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'Add your first manager to help manage the company'
                }
              </p>
              {!searchTerm && (
                <Button onClick={() => router.push('/company/managers/add')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Manager
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredManagers.map((manager) => (
              <Card key={manager.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {manager.first_name[0]}{manager.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium">
                          {manager.first_name} {manager.last_name}
                        </h4>
                        <p className="text-sm text-foreground-muted flex items-center">
                          <Mail className="w-4 h-4 mr-1" />
                          {manager.email}
                        </p>
                        {manager.phone && (
                          <p className="text-sm text-foreground-muted flex items-center">
                            <Phone className="w-4 h-4 mr-1" />
                            {manager.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={manager.is_active ? 'success' : 'warning'}>
                        {manager.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => fetchManagerDetails(manager.id)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleRemoveManager(manager.id)}
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
