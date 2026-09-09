import { logServerEvent } from '@/lib/observability/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = performance.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let healthy = false;
  if (url && key) {
    try {
      const response = await fetch(`${url}/rest/v1/rpc/healthcheck`, {
        method: 'POST',
        headers: { apikey: key, 'content-type': 'application/json' },
        body: '{}',
        cache: 'no-store',
        signal: AbortSignal.timeout(1500),
      });
      healthy = response.ok;
    } catch {
      healthy = false;
    }
  }
  const durationMs = Math.round(performance.now() - started);
  if (!healthy) {
    await logServerEvent({
      event: 'READINESS_CHECK_FAILED',
      level: 'error',
      operation: 'database_healthcheck',
      durationMs,
      success: false,
    });
  }
  return Response.json(
    { status: healthy ? 'healthy' : 'unhealthy' },
    { status: healthy ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
