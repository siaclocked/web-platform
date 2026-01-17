'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import {
  Building2,
  Users,
  Calendar,
  FileText,
  Settings,
  Plus,
  Mail,
  Eye,
  Trash2,
  TrendingUp,
  Clock,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { User, Company } from '@/lib/types/database';

export default function CompanyDashboard() {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [managers, setManagers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const supabase = createClient();
      
      // Get current user and company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      // Get company details
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', userData.company_id)
        .single();

      if (companyError) throw companyError;

      // Get all managers for this company
      const { data: managersData, error: managersError } = await supabase
        .from('users')
        .select('*')
        .eq('company_id', userData.company_id)
        .eq('role', 'manager')
        .eq('is_active', true);

      if (managersError) throw managersError;

      setCompany(companyData);
      setManagers(managersData || []);
    } catch (err) {
      console.error('Error fetching company data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddManager = () => {
    router.push('/dashboard/company/managers/add');
  };

  const handleViewManager = (managerId: string) => {
    router.push(`/dashboard/company/managers/${managerId}`);
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

      // Refresh the managers list
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
        <h1 className="text-2xl font-bold text-foreground">Company Dashboard</h1>
        <p className="text-foreground-muted">Manage your organization and managers</p>
      </div>

      {/* Company Overview */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-foreground">{company?.name}</h2>
              <p className="text-foreground-muted">Company Administrator</p>
            </div>
            <Link href="/dashboard/company/settings">
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-muted rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{managers.length}</p>
                <p className="text-xs text-foreground-muted">Managers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">24</p>
                <p className="text-xs text-foreground-muted">Active Schedules</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success-muted rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">156</p>
                <p className="text-xs text-foreground-muted">Total Workers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-warning-muted rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">1,248</p>
                <p className="text-xs text-foreground-muted">Hours This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Managers Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Managers</h2>
          <Button onClick={handleAddManager} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Manager
          </Button>
        </div>

        {managers.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No managers yet</h3>
              <p className="text-foreground-muted mb-4">
                Add your first manager to start building your team
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/dashboard/company/schedules">
          <Card className="hover:bg-background-secondary transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-12 h-12 bg-primary-muted rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">View All Schedules</p>
                <p className="text-sm text-foreground-muted">
                  Monitor and intervene in schedules
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/company/documents">
          <Card className="hover:bg-background-secondary transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Company Documents</p>
                <p className="text-sm text-foreground-muted">
                  Manage shared documents
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}
