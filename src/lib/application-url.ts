import 'server-only';

export class ApplicationUrlConfigurationError extends Error {
  constructor() {
    super('APPLICATION_URL_NOT_CONFIGURED');
    this.name = 'ApplicationUrlConfigurationError';
  }
}

/** Returns the trusted configured origin; request host headers are never authoritative. */
export function configuredApplicationBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) throw new ApplicationUrlConfigurationError();

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new ApplicationUrlConfigurationError();
  }

  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    (!local && url.protocol !== 'https:') ||
    (local && !['http:', 'https:'].includes(url.protocol))
  )
    throw new ApplicationUrlConfigurationError();

  return new URL('/', url).toString();
}
