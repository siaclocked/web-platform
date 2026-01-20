'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Input, Select, BackButton } from '@/components/ui';
import { Mail, User, Phone, Building2, Briefcase, DollarSign } from 'lucide-react';

export default function AddWorkerPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    positionId: '',
    hourlyRate: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [positions, setPositions] = useState<Array<{id: string, name: string}>>([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(true);

  // Debug: Log positions state changes
  useEffect(() => {
    console.log('Positions state changed:', positions);
  }, [positions]);

  useEffect(() => {
    fetchPositions();
  }, []);

  const fetchPositions = async () => {
    console.log('Fetching positions...');
    try {
      // Get auth token
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session:', session ? 'exists' : 'none');
      
      const response = await fetch('/api/manager/positions', {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
      });
      
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Response data:', data);
        setPositions(data.positions || []);
      } else {
        console.error('Failed to fetch positions:', response.status);
        setPositions([]); // Set empty array on error
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
      setPositions([]); // Set empty array on error
    } finally {
      setIsLoadingPositions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create worker using API route
      const response = await fetch('/api/manager/workers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phone: formData.phone.trim() || null,
          positionId: formData.positionId || null,
          hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
          userId: user.id
        }),
      });

      const { success, error: createError } = await response.json();

      if (!success || createError) {
        throw new Error(createError || 'Failed to create worker account');
      }

      setSuccess(true);
    } catch (err) {
      console.error('Error creating worker:', err);
      setError(err instanceof Error ? err.message : 'Failed to create worker account');
    } finally {
      setIsLoading(false);
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  if (success) {
    return (
      <PageContainer
        title="Success"
        description="Worker account created"
      >
        <Card>
          <CardContent className="text-center py-8">
            <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Worker Created Successfully!</h3>
            <p className="text-muted-foreground mb-6">
              {formData.email} will receive an email to set up their account
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => router.push('/manager/workers')}>
                View Workers
              </Button>
              <Button onClick={() => {
                setSuccess(false);
                setFormData({
                  firstName: '',
                  lastName: '',
                  email: '',
                  phone: '',
                  positionId: '',
                  hourlyRate: '',
                });
              }}>
                Add Another Worker
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Add Worker"
      description="Create a new worker account"
    >
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6">
          <BackButton href="/manager/workers" label="Back to Workers" className="mb-6" />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="John"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
              <Input
                label="Last Name"
                placeholder="Doe"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>

            <Input
              type="email"
              label="Email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Input
              type="tel"
              label="Phone (Optional)"
              placeholder="+1 (555) 123-4567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <Select
              label="Position"
              value={formData.positionId}
              onChange={(e) => setFormData({ ...formData, positionId: e.target.value })}
              required
              disabled={isLoadingPositions}
              placeholder={isLoadingPositions ? 'Loading positions...' : 'Select a position'}
              options={isLoadingPositions ? [] : 
                positions.length === 0 ? 
                [{ value: '', label: 'No positions available. Please add positions first.' }] :
                (positions || []).map(position => ({
                  value: position.id,
                  label: position.name
                }))
              }
            />

            <Input
              type="number"
              step="0.01"
              label="Hourly Rate (Optional)"
              placeholder="15.00"
              value={formData.hourlyRate}
              onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
            />

            {error && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={!formData.firstName || !formData.lastName || !formData.email || !formData.positionId || !isValidEmail(formData.email)}
            >
              Create Worker Account
            </Button>
          </form>

          <p className="text-center text-xs text-foreground-muted mt-6">
            By creating this account, the worker will receive an email to log in
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
