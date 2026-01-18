import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Proxy configuration for Next.js 16 with auth logic
export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Update user's last activity
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    await supabase
      .from('users')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', session.user.id);
  }

  // Refresh session if expired (only if session exists)
  if (session) {
    const { data: refreshResponse, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Error refreshing session:', error);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/auth', '/select-role', '/signup'];
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Protected paths that require authentication
  const protectedPaths = ['/company', '/manager', '/worker', '/managers'];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isPublicPath) {
    // Don't redirect from public paths if user is authenticated
    // Let them navigate freely
    return supabaseResponse;
  }

  return supabaseResponse;
}

// Matcher for which paths to run the proxy on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json
     * - api routes
     * - static files
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
