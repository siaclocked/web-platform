import { createClient } from './supabase/client';

// Clear all auth data
export async function clearAuth() {
  const supabase = createClient();
  await supabase.auth.signOut({ scope: 'local' });
  
  // Clear localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('supabase.auth.token');
    localStorage.removeItem('supabase.auth.refreshToken');
    // Clear all supabase-related items
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('supabase.')) {
        localStorage.removeItem(key);
      }
    });
  }
}
