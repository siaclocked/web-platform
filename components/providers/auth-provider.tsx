'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import type { User } from '@/lib/types/database';
import { clearAuth } from '@/lib/auth-clear';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // Auto sign-out on tab close (not refresh)
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    // Check if it's a tab close, not refresh
    // Note: This is a best effort - browsers don't perfectly distinguish
    // between refresh and close, but we'll use visibility API
    if (document.visibilityState === 'visible') {
      clearAuth();
    }
  };

  // Handle page visibility change (for mobile app close)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      // Page is hidden (app closed or tab switched)
      // Don't immediately sign out, give some time for tab switching
      setTimeout(() => {
        if (document.visibilityState === 'hidden') {
          clearAuth();
        }
      }, 5000); // Wait 5 seconds before signing out
    }
  };

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const fetchUser = async () => {
      try {
        // Check for existing auth session without clearing
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (authUser) {
          // Create minimal profile from auth user
          const profile = {
            id: authUser.id,
            email: authUser.email,
            role: 'admin', // Default role, will be updated when needed
          };
          setUser(profile as User);
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

    fetchUser();

    // Disable auth state change listener to prevent infinite loops
    // We'll handle auth state manually in login/logout functions

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return <>{children}</>;
}
