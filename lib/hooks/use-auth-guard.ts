import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';

/**
 * Hook to guard routes and handle authentication
 * Logs out users when they navigate back to public pages
 */
export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser } = useAuthStore();
  const supabase = createClient();

  useEffect(() => {
    // Define route patterns
    const publicRoutes = ['/login', '/select-role', '/signup'];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) || pathname === '/';
    
    // Protected route patterns
    const protectedRoutes = ['/company', '/manager', '/worker', '/managers'];
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

    const checkAuth = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      // If user is on a public page and is logged in, log them out
      if (authUser && isPublicRoute) {
        console.log('User navigated to public page, logging out');
        await supabase.auth.signOut();
        setUser(null);
      }

      // If user is on a protected page and not logged in, redirect to login
      if (!authUser && isProtectedRoute) {
        console.log('User not authenticated, redirecting to login');
        router.push('/login');
      }
    };

    checkAuth();
  }, [pathname, router, supabase, setUser]);

  return { user };
}

/**
 * Utility function to perform logout
 */
export async function performLogout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  
  // Clear all storage
  if (typeof window !== 'undefined') {
    localStorage.clear();
    sessionStorage.clear();
  }
}