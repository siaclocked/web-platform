'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Input } from '@/components/ui';
import { ArrowLeft, Mail, User, Phone, Building2 } from 'lucide-react';

export default function AddManagerPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      
      // Get current user's company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: currentUser } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!currentUser) throw new Error('Company not found');

      // Create manager account with email (no password - they'll use OTP)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email.trim().toLowerCase(),
        email_confirm: true,
        user_metadata: {
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          phone: formData.phone.trim() || null
        }
      });

      if (authError) throw authError;

      if (!authData.user) throw new Error('Failed to create manager account');

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          company_id: currentUser.company_id,
          email: formData.email.trim().toLowerCase(),
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          phone: formData.phone.trim() || null,
          role: 'manager',
          is_active: true
        });

      if (profileError) throw profileError;

      setSuccess(true);
    } catch (err) {
      console.error('Error creating manager:', err);
      setError(err instanceof Error ? err.message : 'Failed to create manager account');
    } finally {
      setIsLoading(false);
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  if (success) {
    return (
      <PageContainer>
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-8 text-center">
              <div className="w-16 h-16 bg-success-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Manager Account Created
              </h2>
              <p className="text-foreground-muted mb-6">
                {formData.firstName} {formData.lastName} can now sign in with their email using OTP verification.
              </p>
              <div className="bg-background-secondary rounded-lg p-4 mb-6">
                <p className="text-sm text-foreground-muted mb-2">Login details:</p>
                <p className="font-mono text-foreground">{formData.email}</p>
                <p className="text-sm text-foreground-muted mt-1">They will receive a code via email to sign in</p>
              </div>
              <Button onClick={() => router.push('/dashboard/company')}>
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard/company')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Add New Manager</h1>
          <p className="text-foreground-muted">
            Create a manager account for your company
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
                    <Input
                      placeholder="John"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      className="pl-11"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Last Name
                  </label>
                  <Input
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
                  <Input
                    type="email"
                    placeholder="manager@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-11"
                    required
                  />
                </div>
                <p className="text-xs text-foreground-muted mt-1">
                  Manager will use email OTP to sign in
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Phone Number (Optional)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
                  <Input
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="pl-11"
                  />
                </div>
                <p className="text-xs text-foreground-muted mt-1">
                  For future use - currently not required for login
                </p>
              </div>

              {error && (
                <div className="p-3 bg-danger-muted/20 border border-danger/30 rounded-lg">
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
                disabled={
                  !formData.firstName.trim() ||
                  !formData.lastName.trim() ||
                  !isValidEmail(formData.email)
                }
              >
                Create Manager Account
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
