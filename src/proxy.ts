import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routeStoreHostPath, storeSlugFromHost } from '@/lib/store-host';

/** Workspace routes whose Supabase session is refreshed on every request. */
const SESSION_PATHS = [
  '/businesses',
  '/billing',
  '/features',
  '/communications',
  '/payment-operations',
  '/sms-operations',
  '/setup',
  '/login',
  '/auth',
  '/invite',
  '/account',
  '/workspace',
  '/t',
];

function needsSession(pathname: string) {
  return (
    pathname === '/' ||
    SESSION_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  );
}

/** Serves `{slug}.<PLATFORM_ROOT_DOMAIN>` from the existing /store/{slug} routes. */
function storeHostResponse(request: NextRequest, slug: string, requestHeaders: Headers) {
  const route = routeStoreHostPath(slug, request.nextUrl.pathname);
  if (route.kind === 'pass') return NextResponse.next({ request: { headers: requestHeaders } });
  if (route.kind === 'admin') {
    // Admin always lives on the trusted application origin, never the store host.
    try {
      return NextResponse.redirect(new URL(`/t/${slug}`, process.env.NEXT_PUBLIC_APP_URL));
    } catch {
      return new NextResponse(null, { status: 404 });
    }
  }
  const target = request.nextUrl.clone();
  target.pathname = route.pathname;
  return NextResponse.rewrite(target, { request: { headers: requestHeaders } });
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const requestId = crypto.randomUUID();
  requestHeaders.set('x-businesscare-request-id', requestId);

  const storeSlug = storeSlugFromHost(
    request.headers.get('host'),
    process.env.PLATFORM_ROOT_DOMAIN,
  );
  if (storeSlug) {
    const storeResponse = storeHostResponse(request, storeSlug, requestHeaders);
    storeResponse.headers.set('x-businesscare-request-id', requestId);
    return storeResponse;
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-businesscare-request-id', requestId);
  if (!needsSession(request.nextUrl.pathname)) return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response; // Protected server pages still fail closed.
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        response.headers.set('x-businesscare-request-id', requestId);
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  // Every request except static assets: store subdomains can address any path.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
