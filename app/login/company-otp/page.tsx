'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { Mail, ArrowRight, Clock, CheckCircle } from 'lucide-react';

type Step = 'email' | 'otp';

export default function CompanyOTPLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const msg = searchParams.get('message');
    if (msg) {
      setMessage(msg);
    }
  }, [searchParams]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('Sending OTP to:', email.trim().toLowerCase());
      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
        },
      });

      console.log('OTP response:', { data, error });

      if (error) throw error;

      setStep('otp');
    } catch (err) {
      console.error('Send OTP error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('Verifying OTP:', otp);
      const supabase = createClient();

      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: 'email',
      });

      console.log('Verify OTP response:', { data, error });

      if (error) throw error;

      console.log('OTP verified successfully, checking user role...');
      
      // Check if user is a company admin
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user?.id)
        .single();

      if (userData?.role === 'admin') {
        console.log('User is admin, redirecting to company dashboard...');
        router.push('/dashboard/company');
      } else {
        setError('This login is for company administrators only');
      }
    } catch (err) {
      console.error('Verify OTP error:', err);
      setError(err instanceof Error ? err.message : 'Invalid OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Clocked</h1>
          <p className="text-foreground-muted mt-2">
            Company Administrator Login
          </p>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-success-muted/20 border border-success/30 rounded-lg">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">{message}</span>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            {step === 'email' ? (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">
                    Welcome back
                  </h2>
                  <p className="text-sm text-foreground-muted">
                    Enter your email to receive a verification code
                  </p>
                </div>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11"
                    required
                  />
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
                  disabled={!isValidEmail(email)}
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">
                    Check your email
                  </h2>
                  <p className="text-sm text-foreground-muted">
                    We sent a verification code to{' '}
                    <span className="text-foreground">{email}</span>
                  </p>
                </div>

                <Input
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="text-center text-2xl tracking-widest"
                  maxLength={8}
                  required
                  autoFocus
                />

                {error && (
                  <p className="text-sm text-danger bg-danger-muted/20 px-3 py-2 rounded-lg">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={isLoading}
                  disabled={otp.length < 6}
                >
                  Verify
                </Button>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={isLoading}
                    className="w-full text-sm text-primary hover:text-primary-hover transition-colors disabled:opacity-50"
                  >
                    Resend code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setOtp('');
                      setError('');
                    }}
                    className="w-full text-sm text-foreground-muted hover:text-foreground transition-colors"
                  >
                    Use a different email
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            ← Back to login options
          </button>
        </div>

        <p className="text-center text-xs text-foreground-muted mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
