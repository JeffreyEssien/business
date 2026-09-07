import nextEnv from '@next/env';
import postgres from 'postgres';
nextEnv.loadEnvConfig(process.cwd());
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const host = new URL(process.env.DATABASE_URL).hostname;
  const localNoTls =
    process.env.DB_LOCAL_NO_TLS === 'true' && ['localhost', '127.0.0.1'].includes(host);
  return postgres(process.env.DATABASE_URL, {
    ssl: localNoTls ? false : 'require',
    max: 1,
    connect_timeout: 15,
    prepare: false,
    onnotice: () => {},
  });
}
export function reportError(error) {
  // Never print a connection string, SQL parameters, or provider response payload.
  console.error(
    `Database operation failed (${error.code ?? error.name ?? 'unknown'}). Check connection settings and migration prerequisites.`,
  );
  process.exitCode = 1;
}
