'use client';

import React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { Building2, Mail, Lock, ArrowRight, Eye, EyeOff, Clock, User, Phone } from 'lucide-react';

export default function CompanySignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'company' | 'admin'>('company');
  const [companyData, setCompanyData] = useState({
    name: '',
    timezone: 'America/New_York'
  });
  const [adminData, setAdminData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!companyData.name.trim()) {
      setError('Company name is required');
      return;
    }
    
    setStep('admin');
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Validate inputs
      if (!adminData.email.trim() || !adminData.password || !adminData.firstName.trim() || !adminData.lastName.trim()) {
        throw new Error('All fields are required');
      }

      if (adminData.password !== adminData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (adminData.password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      console.log('Calling company signup API...');
      
      // Call the API route instead of direct database access
      const response = await fetch('/api/signup/company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyData,
          adminData
        })
      });

      console.log('API response status:', response.status);
      console.log('API response headers:', response.headers.get('content-type'));

      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('API returned non-JSON response:', text);
        throw new Error('Server returned an invalid response. Please check the console for details.');
      }

      const result = await response.json();
      console.log('API response:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create company account');
      }

      console.log('Company signup successful, redirecting to login...');
      router.push('/login/company-password?message=Company created successfully. You can now sign in with your credentials.');

    } catch (err) {
      console.error('Company signup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create company account');
    } finally {
      setIsLoading(false);
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney'
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Create Company</h1>
          <p className="text-foreground-muted mt-2">
            Set up your organization and start managing your team
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {step === 'company' ? (
              <form onSubmit={handleCompanySubmit} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">
                    Company Information
                  </h2>
                  <p className="text-sm text-foreground-muted">
                    Tell us about your organization
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Company Name
                  </label>
                  <Input
                    type="text"
                    placeholder="Acme Corporation"
                    value={companyData.name}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Timezone
                  </label>
                  <select
                    value={companyData.timezone}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, timezone: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {timezones.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                {error && (
                  <p className="text-sm text-danger bg-danger-muted/20 px-3 py-2 rounded-lg">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={isLoading}
                  disabled={!companyData.name.trim()}
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">
                    Admin Account
                  </h2>
                  <p className="text-sm text-foreground-muted">
                    Create your administrator account for {companyData.name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      First Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
                      <Input
                        type="text"
                        placeholder="John"
                        value={adminData.firstName}
                        onChange={(e) => setAdminData(prev => ({ ...prev, firstName: e.target.value }))}
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
                      type="text"
                      placeholder="Doe"
                      value={adminData.lastName}
                      onChange={(e) => setAdminData(prev => ({ ...prev, lastName: e.target.value }))}
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
                      placeholder="admin@company.com"
                      value={adminData.email}
                      onChange={(e) => setAdminData(prev => ({ ...prev, email: e.target.value }))}
                      className="pl-11"
                      required
                    />
                  </div>
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
                      value={adminData.phone}
                      onChange={(e) => setAdminData(prev => ({ ...prev, phone: e.target.value }))}
                      className="pl-11"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      value={adminData.password}
                      onChange={(e) => setAdminData(prev => ({ ...prev, password: e.target.value }))}
                      className="pl-11 pr-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Confirm Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Confirm your password"
                    value={adminData.confirmPassword}
                    onChange={(e) => setAdminData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-danger bg-danger-muted/20 px-3 py-2 rounded-lg">
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setStep('company')}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    isLoading={isLoading}
                    disabled={
                      !adminData.firstName.trim() ||
                      !adminData.lastName.trim() ||
                      !isValidEmail(adminData.email) ||
                      !adminData.password ||
                      adminData.password !== adminData.confirmPassword ||
                      adminData.password.length < 8
                    }
                  >
                    Create Company
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/select-role')}
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            ← Back to role selection
          </button>
        </div>

        <p className="text-center text-xs text-foreground-muted mt-6">
          By creating a company account, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
