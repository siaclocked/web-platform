import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Block direct access to (app) folder pages
  // These are layout/base pages and should not be accessed directly
  const appGroupPaths = ['/dashboard'];
  const isAppGroupPath = appGroupPaths.some(path => pathname === path);

  if (isAppGroupPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Define public and protected paths
  const publicPaths = ['/login', '/signup', '/api/auth', '/api/test', '/api/signup'];
  const protectedPaths = ['/company', '/manager', '/worker', '/managers'];

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path)) || pathname === '/';
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  // Check if this is a navigation away from protected pages (not a refresh)
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  // Only consider it navigation away if:
  // 1. There's a referer from the same site
  // 2. The referer is from a protected page
  // 3. The current path is NOT a protected page
  // 4. This is not a refresh (same path as referer)
  const isNavigationAway = referer && 
    host && referer.includes(host) &&
    (referer.includes('/company') || referer.includes('/manager') || referer.includes('/worker')) &&
    !pathname.startsWith('/company') && !pathname.startsWith('/manager') && !pathname.startsWith('/worker') &&
    !referer.endsWith(pathname);

  // Only sign out if user is navigating away (not refreshing)
  // Also ensure we're not on API routes or static assets
  if (user && isNavigationAway && !pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
    console.log('User navigating away from protected pages, signing out');
    const url = request.nextUrl.clone();
    
    // Clear the session
    await supabase.auth.signOut();
    
    // Redirect to login
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If user is not logged in and tries to access protected pages
  // Redirect to login
  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json
     * - api (API routes)
     * - static files
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};