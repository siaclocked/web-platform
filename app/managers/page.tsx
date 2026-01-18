'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { Users, Plus, Eye, Trash2, AlertCircle } from 'lucide-react';
import type { User } from '@/lib/types/database';

export default function ManagersPage() {
  const router = useRouter();
  const [managers, setManagers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Not authenticated');

      const { data: currentUser } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!currentUser) throw new Error('Company not found');

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .eq('role', 'manager')
        .eq('is_active', true);

      if (error) throw error;
      setManagers(data || []);
    } catch (err) {
      console.error('Error fetching managers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load managers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddManager = () => {
    router.push('/managers/add');
  };

  const handleViewManager = (managerId: string) => {
    router.push(`/managers/${managerId}`);
  };

  const handleRemoveManager = async (managerId: string) => {
    if (!confirm('Are you sure you want to remove this manager? This action cannot be undone.')) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', managerId);

      if (error) throw error;

      setManagers(prev => prev.filter(m => m.id !== managerId));
    } catch (err) {
      console.error('Error removing manager:', err);
      alert('Failed to remove manager');
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
            <p className="text-foreground-muted mb-4">{error}</p>
            <Button onClick={fetchData}>Try Again</Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Managers</h1>
        <p className="text-foreground-muted">Manage your team managers</p>
      </div>

      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Manager Accounts</h3>
              <p className="text-sm text-foreground-muted">
                Add and manage manager accounts for your company
              </p>
            </div>
            <Button onClick={handleAddManager}>
              <Plus className="w-4 h-4 mr-2" />
              Add Manager
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {managers.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No managers yet</h3>
              <p className="text-foreground-muted mb-4">
                Add your first manager to get started
              </p>
              <Button onClick={handleAddManager}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Manager
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {managers.map((manager) => (
              <Card key={manager.id} className="hover:bg-background-secondary transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-muted rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {manager.first_name} {manager.last_name}
                      </p>
                      <p className="text-sm text-foreground-muted">{manager.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewManager(manager.id)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveManager(manager.id)}
                        className="text-danger hover:text-danger hover:bg-danger-muted/20"
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
