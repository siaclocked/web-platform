'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CompanyLoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Companies don't login - they signup
    router.push('/signup/company');
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-foreground-muted">Redirecting to signup...</p>
      </div>
    </div>
  );
}
