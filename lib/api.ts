// Wraps fetch with the Supabase access token attached as a Bearer Authorization header.
// Throws if there is no active session — callers should redirect to /login on that.

import { createClient } from '@/lib/supabase/client';

export class NotAuthenticatedError extends Error {
  constructor() {
    super('Not authenticated');
    this.name = 'NotAuthenticatedError';
  }
}

export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new NotAuthenticatedError();

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${session.access_token}`);

  return fetch(input, { ...init, headers });
}
