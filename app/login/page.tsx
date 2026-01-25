'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent } from '@/components/ui';
import { Building2, Users, User, ArrowRight, Clock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div 
            className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push('/')}
          >
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Clocked</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Choose Your Login Type
          </h2>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto">
            Select how you want to sign in to your account.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card
            className="hover:bg-background-secondary transition-colors cursor-pointer"
            onClick={() => router.push('/login/company-password')}
          >
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Company Admin
                </h3>
                <p className="text-sm text-foreground-muted">
                  Sign in with email and password
                </p>
              </div>
              <Button className="w-full">
                Sign In
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <Card
            className="hover:bg-background-secondary transition-colors cursor-pointer"
            onClick={() => router.push('/login/manager')}
          >
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-background-tertiary rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Manager
                </h3>
                <p className="text-sm text-foreground-muted">
                  Sign in with email OTP code
                </p>
              </div>
              <Button className="w-full" variant="outline">
                Sign In
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <Card
            className="hover:bg-background-secondary transition-colors cursor-pointer"
            onClick={() => router.push('/login/worker')}
          >
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-background-tertiary rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Worker
                </h3>
                <p className="text-sm text-foreground-muted">
                  Sign in with email OTP code
                </p>
              </div>
              <Button className="w-full" variant="outline">
                Sign In
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-foreground-muted">
            Don't have an account?{' '}
            <button
              onClick={() => router.push('/select-role')}
              className="text-primary hover:text-primary-hover underline"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
