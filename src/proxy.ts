import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const requestId = crypto.randomUUID();
  requestHeaders.set('x-businesscare-request-id', requestId);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-businesscare-request-id', requestId);
  const protectedRequest =
    !request.nextUrl.pathname.startsWith('/store/') &&
    !request.nextUrl.pathname.startsWith('/api/');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!protectedRequest) return response;
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
  matcher: [
    '/',
    '/businesses/:path*',
    '/setup/:path*',
    '/login',
    '/invite',
    '/account',
    '/workspace',
    '/t/:path*',
    '/store/:path*',
    '/api/:path*',
  ],
};
