'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { Users, Plus, Eye, Trash2, Mail, Phone } from 'lucide-react';

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

export default function CompanyManagersPage() {
  const router = useRouter();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    try {
      // Get auth token
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/company/managers', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
      });
      
      if (response.ok) {
        const { managers: managersData } = await response.json();
        setManagers(managersData || []);
      } else {
        setManagers([]);
      }
    } catch (error) {
      console.error('Error fetching managers:', error);
      setManagers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveManager = async (managerId: string) => {
    if (!confirm('Are you sure you want to remove this manager?')) return;
    
    try {
      const response = await fetch('/api/company/managers/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ managerId }),
      });
      
      if (response.ok) {
        fetchManagers(); // Refresh the list
      }
    } catch (error) {
      console.error('Error removing manager:', error);
    }
  };

  return (
    <PageContainer
      title="Managers"
      description="Manage your company managers"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Your Managers</h2>
          <Button onClick={() => router.push('/company/managers/add')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Manager
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading managers...</div>
        ) : managers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No managers yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first manager to help manage the company
              </p>
              <Button onClick={() => router.push('/company/managers/add')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Manager
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {managers.map((manager) => (
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
                        <p className="text-sm text-muted-foreground flex items-center">
                          <Mail className="w-4 h-4 mr-1" />
                          {manager.email}
                        </p>
                        {manager.phone && (
                          <p className="text-sm text-muted-foreground flex items-center">
                            <Phone className="w-4 h-4 mr-1" />
                            {manager.phone}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {manager.companies.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={manager.is_active ? 'success' : 'warning'}>
                        {manager.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button variant="outline" size="sm">
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
