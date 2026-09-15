import { timingSafeEqual } from 'node:crypto';
import { logServerEvent } from '@/lib/observability/server';
import { dispatchQueuedSms } from '@/modules/sms/service';

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
    return Response.json(await dispatchQueuedSms({ limit: 25 }));
  } catch (error) {
    await logServerEvent({
      event: 'sms_delivery_job_failed',
      level: 'error',
      operation: 'dispatch_sms_queue',
      provider: 'termii',
      success: false,
      errorCode: error instanceof Error ? error.name : 'SMS_JOB_FAILED',
    });
    return new Response('Text-message delivery unavailable', { status: 503 });
  }
}
