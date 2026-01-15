'use client';

import { useState } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Input, Badge } from '@/components/ui';
import { Building2, Save, Globe, Clock } from 'lucide-react';

export default function CompanyPage() {
  const [companyName, setCompanyName] = useState('Acme Restaurant Group');
  const [timezone, setTimezone] = useState('America/New_York');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Save company settings
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <PageContainer
      title="Company Settings"
      description="Manage your organization"
    >
      <Card className="mb-4">
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-primary-muted rounded-xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{companyName}</h2>
              <Badge variant="success">Active</Badge>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Default Timezone
              </label>
              <div className="flex items-center gap-2 p-3 bg-background-tertiary rounded-lg">
                <Globe className="w-5 h-5 text-foreground-muted" />
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="flex-1 bg-transparent border-none text-foreground"
                >
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Riga">Riga (EET)</option>
                </select>
              </div>
            </div>

            <Button onClick={handleSave} isLoading={isSaving} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardContent>
          <h3 className="font-semibold text-foreground mb-4">Organization Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-background-tertiary rounded-lg text-center">
              <p className="text-3xl font-bold text-foreground">3</p>
              <p className="text-sm text-foreground-muted">Managers</p>
            </div>
            <div className="p-4 bg-background-tertiary rounded-lg text-center">
              <p className="text-3xl font-bold text-foreground">12</p>
              <p className="text-sm text-foreground-muted">Workers</p>
            </div>
            <div className="p-4 bg-background-tertiary rounded-lg text-center">
              <p className="text-3xl font-bold text-foreground">3</p>
              <p className="text-sm text-foreground-muted">Places</p>
            </div>
            <div className="p-4 bg-background-tertiary rounded-lg text-center">
              <p className="text-3xl font-bold text-foreground">156</p>
              <p className="text-sm text-foreground-muted">Hours This Month</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
