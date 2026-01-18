import { createClient } from './supabase/client';

// Clear auth data (only on tab close/app exit)
export async function clearAuth() {
  const supabase = createClient();
  // Only sign out locally, keep the session for potential re-opening
  await supabase.auth.signOut({ scope: 'local' });
  
  // Only clear sessionStorage, keep localStorage for persistence
  if (typeof window !== 'undefined') {
    // Clear sessionStorage (temporary data)
    Object.keys(sessionStorage).forEach(key => {
      sessionStorage.removeItem(key);
    });
  }
}
