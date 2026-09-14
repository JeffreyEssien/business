import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database } from './database.mjs';

async function cleanupFixtures(sql) {
  const tenants = await sql`
    select id from public.tenants
    where name='Entitlement race fixture' and slug like 'entitlement-race-%'
  `;
  for (const tenant of tenants) {
    await sql`delete from public.audit_logs where tenant_id=${tenant.id}`;
    await sql`delete from public.products where tenant_id=${tenant.id}`;
    await sql`delete from public.tenant_feature_overrides where tenant_id=${tenant.id}`;
    await sql`delete from public.tenant_payment_settings where tenant_id=${tenant.id}`;
    await sql`delete from public.tenant_memberships where tenant_id=${tenant.id}`;
    await sql`delete from public.tenants where id=${tenant.id}`;
  }
  await sql`delete from auth.users where email like 'entitlement-race-%@example.invalid'`;
}

/** Prove that two simultaneous product creates cannot both consume the final slot. */
export async function testProductLimitConcurrency() {
  const setup = database();
  const first = database();
  const second = database();
  const authUserId = randomUUID();
  const tenantId = randomUUID();
  const email = `entitlement-race-${randomUUID()}@example.invalid`;
  const slug = `entitlement-race-${randomUUID()}`;

  async function createProduct(client, productSlug) {
    return client.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub',${authUserId},true)`;
      await tx.unsafe('set local role authenticated');
      return tx`
        select public.save_product(
          ${tenantId}::uuid,null::uuid,${productSlug},${productSlug},'','','',
          100,null,0,false,'DRAFT','{}'::uuid[],null,null,null,null,null,null
        )
      `;
    });
  }

  try {
    await cleanupFixtures(setup);
    await setup`insert into auth.users(id,email,email_confirmed_at) values(${authUserId},${email},now())`;
    const [profile] = await setup`select id from public.users where auth_user_id=${authUserId}`;
    await setup`
      insert into public.tenants(id,name,slug,status,plan_id)
      values(${tenantId},'Entitlement race fixture',${slug},'TRIAL',
       (select id from public.plans where slug='starter'))
    `;
    await setup`
      insert into public.tenant_memberships(tenant_id,user_id,role)
      values(${tenantId},${profile.id},'TENANT_OWNER')
    `;
    await setup`
      insert into public.tenant_feature_overrides(
        tenant_id,feature_key,value,reason,created_by
      ) values(${tenantId},'product_limit','1'::jsonb,'Concurrency regression',${profile.id})
    `;

    const attempts = await Promise.allSettled([
      createProduct(first, 'concurrent-product-a'),
      createProduct(second, 'concurrent-product-b'),
    ]);
    assert.equal(
      attempts.filter((attempt) => attempt.status === 'fulfilled').length,
      1,
      'Exactly one concurrent product create succeeds',
    );
    const rejected = attempts.find((attempt) => attempt.status === 'rejected');
    assert.equal(rejected?.reason?.code, '23514');
    assert.match(rejected?.reason?.message ?? '', /USAGE_LIMIT_EXCEEDED/);
    const [{ count }] = await setup`
      select count(*)::integer as count from public.products where tenant_id=${tenantId}
    `;
    assert.equal(count, 1, 'The committed catalog remains within its effective limit');
  } finally {
    try {
      await cleanupFixtures(setup);
    } finally {
      await Promise.all([setup.end(), first.end(), second.end()]);
    }
  }
}
