import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { database, reportError } from './database.mjs';
let sql;
try {
  sql = database();
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(754209001)`;
    await tx`create schema if not exists businesscare_migrations`;
    await tx`revoke all on schema businesscare_migrations from public, anon, authenticated`;
    await tx`create table if not exists businesscare_migrations.history (name text primary key, checksum text not null, applied_at timestamptz not null default now())`;
    const files = (await readdir('supabase/migrations'))
      .filter((f) => /^\d+_[a-z0-9_]+\.sql$/.test(f))
      .sort();
    for (const name of files) {
      const source = await readFile(`supabase/migrations/${name}`, 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const [existing] =
        await tx`select checksum from businesscare_migrations.history where name=${name}`;
      if (existing) {
        if (existing.checksum !== checksum) throw new Error('Applied migration checksum mismatch');
        console.log(`Already applied: ${name}`);
        continue;
      }
      await tx.unsafe(source);
      await tx`insert into businesscare_migrations.history(name, checksum) values(${name},${checksum})`;
      console.log(`Prepared: ${name}`);
    }
  });
  console.log('Migration transaction committed.');
} catch (error) {
  reportError(error);
} finally {
  if (sql) await sql.end();
}
