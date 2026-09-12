import 'server-only';
import { headers } from 'next/headers';

type ServerEvent = {
  event: string;
  level?: 'info' | 'warning' | 'error';
  operation?: string;
  tenantId?: string;
  resourceType?: string;
  resourceId?: string;
  resultCount?: number;
  durationMs?: number;
  success?: boolean;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: string;
  provider?: string;
  assetKey?: string;
};

/** Emits bounded JSON at operational boundaries without payloads, credentials, or customer data. */
export async function logServerEvent(event: ServerEvent) {
  const requestHeaders = await headers();
  const record = {
    timestamp: new Date().toISOString(),
    level: event.level ?? 'info',
    requestId: requestHeaders.get('x-businesscare-request-id') ?? 'background',
    environment: process.env.NODE_ENV ?? 'unknown',
    ...event,
  };
  const output = JSON.stringify(record);
  if (record.level === 'error') console.error(output);
  else if (record.level === 'warning') console.warn(output);
  else console.info(output);
}

export async function recordServerOperation({
  event,
  operation,
  startedAt,
  tenantId,
  resultCount,
  errorCode,
}: {
  event: string;
  operation: string;
  startedAt: number;
  tenantId?: string;
  resultCount?: number;
  errorCode?: string;
}) {
  const durationMs = Math.round(performance.now() - startedAt);
  const configured = Number(process.env.SLOW_OPERATION_THRESHOLD_MS ?? 1500);
  const threshold = Number.isFinite(configured) && configured >= 50 ? configured : 1500;
  if (!errorCode && durationMs < threshold) return;
  await logServerEvent({
    event,
    level: errorCode ? 'error' : 'warning',
    operation,
    tenantId,
    durationMs,
    success: !errorCode,
    errorCode,
    resultCount,
  });
}
