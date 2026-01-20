'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge, Input } from '@/components/ui';
import { Users, Plus, Eye, Trash2, Mail, Phone, Search } from 'lucide-react';

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
  const [filteredManagers, setFilteredManagers] = useState<Manager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchManagers();
  }, []);

  useEffect(() => {
    // Filter managers based on search term
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-semibold">Your Managers</h2>
          <Button onClick={() => router.push('/company/managers/add')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Manager
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
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
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">
                {searchTerm ? 'No managers found' : 'No managers yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
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
