'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button } from '@/components/ui';

import { Building2, Mail, Phone, MapPin, Clock, Save } from 'lucide-react';
import { authedFetch, NotAuthenticatedError } from '@/lib/api';

interface Company {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  phone: string | null;
  first_name: string;
  last_name: string;
}

export default function CompanySettingsPage() {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
  const [editedCompany, setEditedCompany] = useState({
    name: '',
  });

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    setIsLoading(true);
    try {
      const response = await authedFetch('/api/company/settings');

      if (!response.ok) {
        console.error('Error fetching company settings');
        return;
      }

      const data = await response.json();
      setCompany(data.company);
      setAdmin(data.admin);
      setEditedCompany({
        name: data.company.name,
      });
    } catch (error) {
      if (error instanceof NotAuthenticatedError) {
        router.push('/login');
        return;
      }
      console.error('Error fetching company data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!company) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const response = await authedFetch('/api/company/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedCompany),
      });

      if (response.ok) {
        setSaveMessage('Changes saved successfully');
        await fetchCompanyData();
      } else {
        const err = await response.json();
        setSaveMessage(err.error || 'Failed to save changes');
      }
    } catch (error) {
      if (error instanceof NotAuthenticatedError) {
        router.push('/login');
        return;
      }
      console.error('Error saving:', error);
      setSaveMessage('An error occurred');
    } finally {
      setSaving(false);
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

  if (!company || !admin) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-foreground-muted">Unable to load company settings</p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const hasChanges = 
    editedCompany.name !== company.name;

  return (
    <PageContainer
      title="Company Settings"
      description="Manage your company information"
    >
      <div className="space-y-6">
        {/* Save button at top */}
        {hasChanges && (
          <Card className="border-l-4 border-l-warning">
            <CardContent className="p-4 flex items-center justify-between">
              <p className="text-sm text-foreground-muted">You have unsaved changes</p>
              <Button onClick={handleSave} isLoading={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        )}

        {saveMessage && (
          <Card className={`border-l-4 ${saveMessage.includes('success') ? 'border-l-success' : 'border-l-danger'}`}>
            <CardContent className="p-4">
              <p className="text-sm">{saveMessage}</p>
            </CardContent>
          </Card>
        )}

        {/* Company Information */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Company Information</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={editedCompany.name}
                  onChange={(e) => setEditedCompany(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2 border border-border rounded-lg bg-background text-foreground"
                  placeholder="Enter company name"
                />
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-foreground-muted">
                  <Clock className="w-4 h-4" />
                  <span>Created: {new Date(company.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground-muted mt-1">
                  <Clock className="w-4 h-4" />
                  <span>Last Updated: {new Date(company.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Information (Read-only) */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Mail className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Administrator</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground-muted mb-1">
                  Name
                </label>
                <p className="text-foreground">{admin.first_name} {admin.last_name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground-muted mb-1">
                  Email
                </label>
                <p className="text-foreground">{admin.email}</p>
              </div>

              {admin.phone && (
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-1">
                    Phone
                  </label>
                  <p className="text-foreground">{admin.phone}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
