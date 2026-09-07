import 'server-only';
import { createClient } from '@supabase/supabase-js';
// Only call after verifying the platform administrator in the invoking action.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Administrative authentication is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
