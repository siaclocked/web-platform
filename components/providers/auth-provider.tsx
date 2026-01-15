'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import type { User } from '@/lib/types/database';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const supabase = createClient();

    const fetchUser = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (authUser) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

          setUser(profile as User);
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
      if (event === 'SIGNED_IN' && session?.user) {
        let { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        // If user doesn't exist in users table, create them
        if (!profile) {
          // Create a default company first
          const { data: company } = await supabase
            .from('companies')
            .select('id')
            .eq('name', 'Default Company')
            .single();

          let companyId = company?.id;
          
          if (!companyId) {
            const { data: newCompany } = await supabase
              .from('companies')
              .insert({ name: 'Default Company' })
              .select('id')
              .single();
            companyId = newCompany?.id;
          }

          const { data: newProfile } = await supabase
            .from('users')
            .insert({
              id: session.user.id,
              email: session.user.email,
              first_name: session.user.user_metadata?.first_name || 'New',
              last_name: session.user.user_metadata?.last_name || 'User',
              role: 'worker',
              company_id: companyId,
            })
            .select()
            .single();
          
          profile = newProfile;
        }

        setUser(profile as User);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);

  return <>{children}</>;
}
