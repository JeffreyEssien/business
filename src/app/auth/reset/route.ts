import { NextResponse } from 'next/server';
import { configuredApplicationBaseUrl } from '@/lib/application-url';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Landing point for password-reset emails. Supabase sends either a PKCE `code`
 * (default template) or a `token_hash` (custom template); both are verified
 * server-side before a session exists. Redirects always target the configured
 * origin and fixed paths, so the link cannot be turned into an open redirect.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const base = configuredApplicationBaseUrl();

  const supabase = await createClient();
  let verified = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } else if (tokenHash && params.get('type') === 'recovery') {
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
    verified = !error;
  }

  return NextResponse.redirect(
    new URL(verified ? '/login/reset' : '/login/forgot?error=expired', base),
  );
}
