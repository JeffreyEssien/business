import { database, reportError } from './database.mjs';
let sql;
try {
  sql = database();
  const email = process.env.PLATFORM_OWNER_EMAIL?.trim();
  if (!email) throw new Error('PLATFORM_OWNER_EMAIL required');
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(754209002)`;
    const users =
      await tx`select u.id from public.users u join auth.users a on a.id=u.auth_user_id where lower(a.email)=lower(${email}) and a.email_confirmed_at is not null and u.status='ACTIVE'`;
    if (users.length !== 1) {
      console.error(
        'Create and confirm the intended owner in Supabase Authentication first. No role changed.',
      );
      throw new Error('Owner account not ready');
    }
    const [owner] = users;
    const [other] =
      await tx`select id from public.users where platform_role='SUPER_ADMIN' and id<>${owner.id}`;
    if (other) throw new Error('An owner already exists; use a reviewed administration flow');
    const changed =
      await tx`update public.users set platform_role='SUPER_ADMIN' where id=${owner.id} and platform_role is distinct from 'SUPER_ADMIN' returning id`;
    if (changed.length)
      await tx`insert into public.audit_logs(actor_user_id,action,resource_type,resource_id) values(${owner.id},'PLATFORM_OWNER_BOOTSTRAPPED','users',${owner.id})`;
  });
  console.log('Owner role verified and bootstrap recorded. No email was sent.');
} catch (error) {
  reportError(error);
} finally {
  if (sql) await sql.end();
}
