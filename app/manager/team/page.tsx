'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge, Input, Toggle } from '@/components/ui';
import { Users, Plus, Trash2, Search, ChevronRight, Filter, Palmtree, CalendarDays } from 'lucide-react';

interface PositionItem {
  id: string;
  name: string;
  rating: number;
}

interface PlaceItem {
  id: string;
  name: string;
}

interface Worker {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  hourly_rate?: number;
  monthly_min_hours?: number | null;
  monthly_optimal_hours?: number | null;
  status?: string;
  start_date?: string;
  can_open?: boolean;
  can_close?: boolean;
  positions: PositionItem[];
  places: PlaceItem[];
}

interface Position {
  id: string;
  name: string;
}

interface Place {
  id: string;
  name: string;
}

interface PaidLeaveRecord {
  id: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
}

export default function ManagerWorkersPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [editForm, setEditForm] = useState({
    hourly_rate: '',
    monthly_min_hours: '',
    monthly_optimal_hours: '',
    status: 'ACTIVE',
    start_date: '',
    can_open: true,
    can_close: true,
  });
  const [editPositionRatings, setEditPositionRatings] = useState<Record<string, number>>({});
  const [editPositions, setEditPositions] = useState<string[]>([]);
  const [editPlaces, setEditPlaces] = useState<string[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Paid leave state
  const [showPaidLeave, setShowPaidLeave] = useState<string | null>(null);
  const [paidLeaveForm, setPaidLeaveForm] = useState({ start_date: '', end_date: '', notes: '' });
  const [paidLeaveRecords, setPaidLeaveRecords] = useState<PaidLeaveRecord[]>([]);
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [isLoadingLeave, setIsLoadingLeave] = useState(false);

  useEffect(() => {
    fetchWorkers();
    fetchPositions();
    fetchPlaces();
  }, []);

  useEffect(() => {
    // Filter workers based on search term
    if (searchTerm.trim() === '') {
      setFilteredWorkers(workers);
    } else {
      const searchLower = searchTerm.toLowerCase();
      const filtered = workers.filter(worker => 
        worker.first_name.toLowerCase().includes(searchLower) ||
        worker.last_name.toLowerCase().includes(searchLower) ||
        worker.email.toLowerCase().includes(searchLower) ||
        `${worker.first_name} ${worker.last_name}`.toLowerCase().includes(searchLower) ||
        `${worker.last_name} ${worker.first_name}`.toLowerCase().includes(searchLower)
      );
      setFilteredWorkers(filtered);
    }
  }, [searchTerm, workers]);

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
        setFilteredWorkers(workersData || []);
      } else {
        setWorkers([]);
        setFilteredWorkers([]);
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
      }
    } catch (error) {
      console.error('Error fetching places:', error);
    }
  };

  const handleEditWorker = (worker: Worker) => {
    setEditingWorker(worker);
    setEditForm({
      hourly_rate: worker.hourly_rate ? worker.hourly_rate.toString() : '',
      monthly_min_hours: worker.monthly_min_hours ? worker.monthly_min_hours.toString() : '',
      monthly_optimal_hours: worker.monthly_optimal_hours ? worker.monthly_optimal_hours.toString() : '',
      status: worker.status || 'ACTIVE',
      start_date: worker.start_date || '',
      can_open: worker.can_open ?? true,
      can_close: worker.can_close ?? true,
    });
    setEditPositions(worker.positions.map(p => p.id));
    // Initialize per-position ratings from existing worker data
    const ratings: Record<string, number> = {};
    worker.positions.forEach(p => { ratings[p.id] = p.rating ?? 5; });
    setEditPositionRatings(ratings);
    setEditPlaces(worker.places.map(p => p.id));
    setError('');
    setSuccess('');
  };

  const toggleEditPosition = (positionId: string) => {
    setEditPositions(prev => {
      if (prev.includes(positionId)) {
        // Remove position and its rating
        const newRatings = { ...editPositionRatings };
        delete newRatings[positionId];
        setEditPositionRatings(newRatings);
        return prev.filter(id => id !== positionId);
      } else {
        // Add position with default rating
        setEditPositionRatings(prev => ({ ...prev, [positionId]: 5 }));
        return [...prev, positionId];
      }
    });
  };

  const toggleEditPlace = (placeId: string) => {
    setEditPlaces(prev => 
      prev.includes(placeId) 
        ? prev.filter(id => id !== placeId)
        : [...prev, placeId]
    );
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
        positionIds: editPositions,
        positionRatings: editPositionRatings,
        placeIds: editPlaces,
        hourly_rate: editForm.hourly_rate ? parseFloat(editForm.hourly_rate) : null,
        monthly_min_hours: editForm.monthly_min_hours ? parseFloat(editForm.monthly_min_hours) : null,
        monthly_optimal_hours: editForm.monthly_optimal_hours ? parseFloat(editForm.monthly_optimal_hours) : null,
        status: editForm.status,
        start_date: editForm.start_date || null,
        can_open: editForm.can_open,
        can_close: editForm.can_close,
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
        setSuccess('Team member updated successfully!');
        fetchWorkers();
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

  const fetchPaidLeave = async (workerId: string) => {
    setIsLoadingLeave(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/manager/paid-leave?worker_id=${workerId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPaidLeaveRecords(data.paid_leave || []);
      }
    } catch (err) {
      console.error('Error fetching paid leave:', err);
    } finally {
      setIsLoadingLeave(false);
    }
  };

  const handleGrantPaidLeave = async (workerId: string) => {
    if (!paidLeaveForm.start_date || !paidLeaveForm.end_date) {
      setError('Start and end dates are required');
      return;
    }
    setIsSubmittingLeave(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/manager/paid-leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          worker_id: workerId,
          start_date: paidLeaveForm.start_date,
          end_date: paidLeaveForm.end_date,
          notes: paidLeaveForm.notes || null,
        }),
      });
      if (res.ok) {
        setSuccess('Paid leave granted successfully!');
        setPaidLeaveForm({ start_date: '', end_date: '', notes: '' });
        await fetchPaidLeave(workerId);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to grant paid leave');
      }
    } catch {
      setError('Failed to grant paid leave');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleDeletePaidLeave = async (leaveId: string, workerId: string) => {
    if (!confirm('Remove this paid leave? The vacation days will be cleared.')) return;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/manager/paid-leave?id=${leaveId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` },
      });
      if (res.ok) {
        setSuccess('Paid leave removed');
        await fetchPaidLeave(workerId);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error deleting paid leave:', err);
    }
  };

  const togglePaidLeave = async (workerId: string) => {
    if (showPaidLeave === workerId) {
      setShowPaidLeave(null);
      setPaidLeaveRecords([]);
    } else {
      setShowPaidLeave(workerId);
      await fetchPaidLeave(workerId);
    }
  };

  const handleCancelEdit = () => {
    setEditingWorker(null);
    setEditForm({
      hourly_rate: '',
      monthly_min_hours: '',
      monthly_optimal_hours: '',
      status: 'ACTIVE',
      start_date: '',
      can_open: true,
      can_close: true,
    });
    setEditPositionRatings({});
    setEditPositions([]);
    setEditPlaces([]);
    setError('');
    setSuccess('');
    setShowPaidLeave(null);
    setPaidLeaveRecords([]);
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Search Bar + Filter — wireframe style */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted w-4 h-4" />
            <Input
              type="text"
              placeholder="Search team members etc."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <button className="p-2.5 rounded-lg border border-border hover:bg-background-secondary transition-colors">
            <Filter className="w-4 h-4 text-foreground-muted" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading workers...</div>
        ) : filteredWorkers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
              <h3 className="text-lg font-medium mb-2">
                {searchTerm ? 'No team members found' : 'No team members yet'}
              </h3>
              <p className="text-foreground-muted mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'Add your first team member'
                }
              </p>
              {!searchTerm && (
                <Button onClick={() => router.push('/manager/team/add')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Team Member
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-0">
            {filteredWorkers.map((worker) => (
              <div key={worker.id}>
                {/* Row view — wireframe style */}
                {editingWorker?.id !== worker.id ? (
                  <div
                    className="flex items-center gap-4 px-4 py-3 bg-background border border-border rounded-xl mb-2 hover:bg-background-secondary/50 transition-colors cursor-pointer"
                    onClick={() => handleEditWorker(worker)}
                  >
                    <div className="w-10 h-10 bg-foreground-muted/20 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-foreground">
                        {worker.first_name[0]}{worker.last_name[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">
                        {worker.first_name} {worker.last_name}
                      </span>
                      <span className="text-foreground-muted ml-3 text-sm">
                        {worker.positions.map(p => p.name).join(', ') || 'No position'}
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-foreground-muted shrink-0" />
                  </div>
                ) : (
                  <Card className="mb-2">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-foreground-muted/20 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-foreground">
                            {worker.first_name[0]}{worker.last_name[0]}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">{worker.first_name} {worker.last_name}</h4>
                          <p className="text-sm text-foreground-muted">{worker.email}</p>
                        </div>
                        <Badge variant={
                          worker.status === 'ACTIVE' ? 'success' :
                          worker.status === 'INVITED' ? 'info' :
                          worker.status === 'DISABLED' ? 'danger' :
                          worker.is_active ? 'success' : 'warning'
                        } className="ml-auto">
                          {worker.status || (worker.is_active ? 'Active' : 'Inactive')}
                        </Badge>
                      </div>

                      <div className="space-y-3 border-t border-border pt-3">
                        <div>
                          <label className="block text-xs font-medium text-foreground-muted mb-1">Positions</label>
                          <div className="border rounded-lg p-2 bg-background max-h-32 overflow-y-auto">
                            {positions.length === 0 ? (
                              <p className="text-xs text-foreground-muted">No positions available</p>
                            ) : (
                              positions.map(position => (
                                <label key={position.id} className="flex items-center gap-2 p-1 hover:bg-background-secondary rounded cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editPositions.includes(position.id)}
                                    onChange={() => toggleEditPosition(position.id)}
                                    className="rounded"
                                  />
                                  <span className="text-sm">{position.name}</span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-foreground-muted mb-1">Work Locations</label>
                          <div className="border rounded-lg p-2 bg-background max-h-32 overflow-y-auto">
                            {places.length === 0 ? (
                              <p className="text-xs text-foreground-muted">No places available</p>
                            ) : (
                              places.map(place => (
                                <label key={place.id} className="flex items-center gap-2 p-1 hover:bg-background-secondary rounded cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editPlaces.includes(place.id)}
                                    onChange={() => toggleEditPlace(place.id)}
                                    className="rounded"
                                  />
                                  <span className="text-sm">{place.name}</span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-foreground-muted mb-1">Hourly Rate <span className="text-danger">*</span></label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="15.00"
                              value={editForm.hourly_rate}
                              onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-foreground-muted mb-1">Status</label>
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                              className="w-full p-2 border border-border rounded-lg text-sm"
                            >
                              <option value="INVITED">Invited</option>
                              <option value="ACTIVE">Active</option>
                              <option value="DISABLED">Disabled</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-foreground-muted mb-1">Monthly Min Hours <span className="text-danger">*</span></label>
                            <Input
                              type="number"
                              min="0"
                              step="0.25"
                              placeholder="80"
                              value={editForm.monthly_min_hours}
                              onChange={(e) => setEditForm({ ...editForm, monthly_min_hours: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-foreground-muted mb-1">Monthly Optimal Hours <span className="text-danger">*</span></label>
                            <Input
                              type="number"
                              min="0"
                              step="0.25"
                              placeholder="160"
                              value={editForm.monthly_optimal_hours}
                              onChange={(e) => setEditForm({ ...editForm, monthly_optimal_hours: e.target.value })}
                              required
                            />
                          </div>
                        </div>

	                        <div className="grid grid-cols-2 gap-3">
	                          <div>
	                            <label className="block text-xs font-medium text-foreground-muted mb-1">Start Date <span className="text-danger">*</span></label>
                            <input
                              type="date"
                              value={editForm.start_date}
                              onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                              className="w-full p-2 border border-border rounded-lg bg-background text-foreground text-sm"
                            />
                          </div>
                        </div>

                        {editPositions.length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-foreground-muted mb-1">
                              Position Ratings
                            </label>
                            <div className="space-y-2 border rounded-lg p-2 bg-background">
                              {editPositions.map(posId => {
                                const pos = positions.find(p => p.id === posId);
                                if (!pos) return null;
                                return (
                                  <div key={posId} className="flex items-center gap-2">
                                    <span className="text-sm min-w-[80px] truncate">{pos.name}</span>
                                    <input
                                      type="range"
                                      min="1"
                                      max="10"
                                      value={editPositionRatings[posId] ?? 5}
                                      onChange={(e) => setEditPositionRatings(prev => ({
                                        ...prev,
                                        [posId]: parseInt(e.target.value)
                                      }))}
                                      className="flex-1 accent-primary"
                                    />
                                    <span className="text-xs font-medium text-foreground w-10 text-center">
                                      {editPositionRatings[posId] ?? 5}/10
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-border p-2">
                            <p className="text-xs font-medium text-foreground-muted mb-2">Opening Eligibility</p>
                            <Toggle
                              checked={editForm.can_open}
                              onChange={(checked) => setEditForm({ ...editForm, can_open: checked })}
                              label="Can open"
                            />
                          </div>
                          <div className="rounded-lg border border-border p-2">
                            <p className="text-xs font-medium text-foreground-muted mb-2">Closing Eligibility</p>
                            <Toggle
                              checked={editForm.can_close}
                              onChange={(checked) => setEditForm({ ...editForm, can_close: checked })}
                              label="Can close"
                            />
                          </div>
                        </div>
                        
                        {error && (
                          <div className="p-2 bg-danger-muted border border-danger/30 rounded">
                            <p className="text-xs text-danger">{error}</p>
                          </div>
                        )}

                        {success && (
                          <div className="p-2 bg-success-muted border border-success/30 rounded">
                            <p className="text-xs text-success">{success}</p>
                          </div>
                        )}

                        {/* Paid Leave Section */}
                        <div className="border-t border-border pt-3">
                          <button
                            onClick={() => togglePaidLeave(worker.id)}
                            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors w-full"
                          >
                            <Palmtree className="w-4 h-4" />
                            Paid Leave
                            <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${showPaidLeave === worker.id ? 'rotate-90' : ''}`} />
                          </button>

                          {showPaidLeave === worker.id && (
                            <div className="mt-3 space-y-3">
                              {/* Grant form */}
                              <div className="p-3 bg-background-secondary rounded-lg space-y-2">
                                <p className="text-xs font-medium text-foreground-muted">Grant Paid Leave</p>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-xs text-foreground-muted mb-1">Start Date</label>
                                    <input
                                      type="date"
                                      value={paidLeaveForm.start_date}
                                      onChange={(e) => setPaidLeaveForm(f => ({ ...f, start_date: e.target.value }))}
                                      className="w-full p-2 border border-border rounded-lg bg-background text-foreground text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-foreground-muted mb-1">End Date</label>
                                    <input
                                      type="date"
                                      value={paidLeaveForm.end_date}
                                      onChange={(e) => setPaidLeaveForm(f => ({ ...f, end_date: e.target.value }))}
                                      className="w-full p-2 border border-border rounded-lg bg-background text-foreground text-sm"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs text-foreground-muted mb-1">Notes (optional)</label>
                                  <Input
                                    value={paidLeaveForm.notes}
                                    onChange={(e) => setPaidLeaveForm(f => ({ ...f, notes: e.target.value }))}
                                    placeholder="e.g., Annual vacation"
                                  />
                                </div>
                                <Button size="sm" onClick={() => handleGrantPaidLeave(worker.id)} isLoading={isSubmittingLeave}>
                                  <CalendarDays className="w-3.5 h-3.5 mr-1" />
                                  Grant Paid Leave
                                </Button>
                              </div>

                              {/* Existing records */}
                              {isLoadingLeave ? (
                                <div className="flex items-center justify-center py-3">
                                  <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                                </div>
                              ) : paidLeaveRecords.length > 0 ? (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-foreground-muted">Active Paid Leave</p>
                                  {paidLeaveRecords.map((pl) => (
                                    <div key={pl.id} className="flex items-center justify-between p-2 bg-background-secondary rounded-lg">
                                      <div>
                                        <p className="text-sm font-medium text-foreground">
                                          {new Date(pl.start_date).toLocaleDateString()} – {new Date(pl.end_date).toLocaleDateString()}
                                        </p>
                                        {pl.notes && <p className="text-xs text-foreground-muted">{pl.notes}</p>}
                                      </div>
                                      <Button variant="danger" size="sm" onClick={() => handleDeletePaidLeave(pl.id, worker.id)}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-foreground-muted">No paid leave records</p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleUpdateWorker} isLoading={isUpdating}>Save</Button>
                          <Button variant="outline" size="sm" onClick={handleCancelEdit}>Cancel</Button>
                          <Button variant="danger" size="sm" onClick={() => handleRemoveWorker(worker.id)} className="ml-auto">
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ))}

            {/* Add New Team Member — wireframe style */}
            <div
              className="flex items-center gap-4 px-4 py-3 bg-background-secondary border border-border border-dashed rounded-xl mt-2 hover:bg-background-tertiary transition-colors cursor-pointer"
              onClick={() => router.push('/manager/team/add')}
            >
              <div className="w-10 h-10 bg-background border border-border rounded-full flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-foreground-muted" />
              </div>
              <span className="font-medium text-foreground">Add New Team Member</span>
              <Plus className="w-5 h-5 text-foreground-muted ml-auto" />
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
