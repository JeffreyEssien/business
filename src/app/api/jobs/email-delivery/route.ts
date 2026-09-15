import { timingSafeEqual } from 'node:crypto';
import { logServerEvent } from '@/lib/observability/server';
import { dispatchQueuedEmails } from '@/modules/email/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const configured = process.env.CRON_SECRET ?? '';
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!configured || configured.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(configured), Buffer.from(supplied));
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response('Unauthorized', { status: 401 });
  try {
    const result = await dispatchQueuedEmails({ limit: 25 });
    return Response.json(result);
  } catch (error) {
    await logServerEvent({
      event: 'email_delivery_job_failed',
      level: 'error',
      operation: 'dispatch_email_queue',
      provider: 'resend',
      success: false,
      errorCode: error instanceof Error ? error.name : 'EMAIL_JOB_FAILED',
    });
    return new Response('Email delivery unavailable', { status: 503 });
  }
}
