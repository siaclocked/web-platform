'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import type { User } from '@/lib/types/database';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // Track if this is a page unload (tab close) vs navigation
  useEffect(() => {
    let isUnloading = false;

    const clearAuth = () => {
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      supabase.auth.signOut({ scope: 'local' });
    };

    // Handle page visibility change (for tab close/app close)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Page is hidden - store timestamp
        sessionStorage.setItem('pageHiddenAt', Date.now().toString());
      } else if (document.visibilityState === 'visible') {
        // Page is visible again - check if it was a long time (tab switch vs app close)
        const hiddenAt = sessionStorage.getItem('pageHiddenAt');
        if (hiddenAt) {
          const timeHidden = Date.now() - parseInt(hiddenAt);
          // If hidden for more than 5 seconds, likely app close/tab close
          if (timeHidden > 5000) {
            clearAuth();
          }
          sessionStorage.removeItem('pageHiddenAt');
        }
      }
    };

    // Handle beforeunload for tab close (best effort detection)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Set a flag that we're unloading
      sessionStorage.setItem('isUnloading', 'true');
    };

    // Check if we're returning from a tab close
    const checkPageLoad = () => {
      const wasUnloading = sessionStorage.getItem('isUnloading');
      if (wasUnloading) {
        // If we were unloading and now we're back, it was a refresh
        sessionStorage.removeItem('isUnloading');
      } else {
        // Normal page load or new tab
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Check on initial load
    checkPageLoad();

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabase, setUser, router]);

  // Don't handle route-based logout here - let middleware handle it
  // This prevents logout on refresh

  // Initial auth check
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (authUser) {
          // Fetch full user profile using service role API
          const response = await fetch('/api/auth/get-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: authUser.id }),
          });

          if (response.ok) {
            const { profile } = await response.json();
            if (profile) {
              setUser(profile);
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
        } else if (event === 'SIGNED_IN' && session?.user) {
          // Fetch full profile
          const response = await fetch('/api/auth/get-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: session.user.id }),
          });

          if (response.ok) {
            const { profile } = await response.json();
            if (profile) {
              setUser(profile);
            }
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, setUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}