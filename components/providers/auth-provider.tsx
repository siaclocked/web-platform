'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import type { User } from '@/lib/types/database';
import { clearAuth } from '@/lib/auth-clear';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const supabase = createClient();

    // Auto sign out when tab is closed
    const handleBeforeUnload = () => {
      supabase.auth.signOut({ scope: 'local' });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    const fetchUser = async () => {
      try {
        // First clear any existing auth to prevent loops
        await clearAuth();
        
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (authUser) {
          const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (error) {
            // User not found in database, sign out
            console.log('User not in database, signing out');
            await supabase.auth.signOut({ scope: 'local' });
            setUser(null);
          } else if (profile) {
            setUser(profile as User);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.id);
      
      if (event === 'SIGNED_IN' && session?.user) {
        let { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        console.log('Profile query result:', { profile, error });

        // If user doesn't exist in users table, sign them out
        if (error || !profile) {
          console.log('User not found in database, signing out');
          await supabase.auth.signOut({ scope: 'local' });
          setUser(null);
          setLoading(false);
          return;
        }

        console.log('User found, setting profile:', profile);
        setUser(profile as User);
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [setUser, setLoading]);

  return <>{children}</>;
}
