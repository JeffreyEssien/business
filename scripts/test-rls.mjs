import { readFile, readdir } from 'node:fs/promises';
import { database, reportError } from './database.mjs';
let sql;
try {
  sql = database();
  for (const file of (await readdir('supabase/tests')).filter((f) => f.endsWith('.sql')).sort()) {
    const rollback = new Error('Successful tests; roll back fixtures');
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(await readFile(`supabase/tests/${file}`, 'utf8'));
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) {
        console.error(`Failed suite: ${file}`);
        if (String(error.code ?? '').startsWith('42') || error.code === 'P0001') {
          console.error(`SQL test error: ${error.message}`);
        }
        throw error;
      }
    }
    console.log(`PASS: ${file}; all fixtures rolled back.`);
  }
} catch (error) {
  reportError(error);
} finally {
  if (sql) await sql.end();
}
