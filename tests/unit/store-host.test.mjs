import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { routeStoreHostPath, storeSlugFromHost } from '../../src/lib/store-host.ts';

describe('storeSlugFromHost', () => {
  const domain = 'businesscare.ng';

  test('returns the store handle for a single-label subdomain', () => {
    assert.equal(storeSlugFromHost('xelle.businesscare.ng', domain), 'xelle');
    assert.equal(storeSlugFromHost('Fresh-Cuts.BusinessCare.ng:443', domain), 'fresh-cuts');
    assert.equal(storeSlugFromHost('xelle.businesscare.ng.', domain), 'xelle');
  });

  test('ignores the bare domain, other domains, and nested subdomains', () => {
    assert.equal(storeSlugFromHost('businesscare.ng', domain), null);
    assert.equal(storeSlugFromHost('xelle.example.com', domain), null);
    assert.equal(storeSlugFromHost('xelle.businesscare.ng.evil.com', domain), null);
    assert.equal(storeSlugFromHost('a.b.businesscare.ng', domain), null);
    assert.equal(storeSlugFromHost('xellebusinesscare.ng', domain), null);
  });

  test('ignores reserved platform subdomains and invalid labels', () => {
    for (const label of ['www', 'app', 'admin', 'api', 'mail'])
      assert.equal(storeSlugFromHost(`${label}.businesscare.ng`, domain), null);
    assert.equal(storeSlugFromHost('-xelle.businesscare.ng', domain), null);
    assert.equal(storeSlugFromHost('xel_le.businesscare.ng', domain), null);
  });

  test('is disabled when no platform domain is configured', () => {
    assert.equal(storeSlugFromHost('xelle.businesscare.ng', undefined), null);
    assert.equal(storeSlugFromHost('xelle.businesscare.ng', ''), null);
    assert.equal(storeSlugFromHost(null, domain), null);
  });

  test('supports local development hosts', () => {
    assert.equal(storeSlugFromHost('xelle.localhost:3001', 'localhost'), 'xelle');
  });
});

describe('routeStoreHostPath', () => {
  test('maps clean paths into the store', () => {
    assert.deepEqual(routeStoreHostPath('xelle', '/'), {
      kind: 'rewrite',
      pathname: '/store/xelle',
    });
    assert.deepEqual(routeStoreHostPath('xelle', '/products/linen-shirt'), {
      kind: 'rewrite',
      pathname: '/store/xelle/products/linen-shirt',
    });
    assert.deepEqual(routeStoreHostPath('xelle', '/robots.txt'), {
      kind: 'rewrite',
      pathname: '/store/xelle/robots.txt',
    });
  });

  test("keeps the store's own /store links working", () => {
    assert.deepEqual(routeStoreHostPath('xelle', '/store/xelle'), { kind: 'pass' });
    assert.deepEqual(routeStoreHostPath('xelle', '/store/xelle/cart'), { kind: 'pass' });
  });

  test("never serves another store's pages on this host", () => {
    for (const path of ['/store/freshcuts', '/store/freshcuts/cart', '/store', '/store/'])
      assert.equal(routeStoreHostPath('xelle', path).kind, 'not-found');
    assert.equal(routeStoreHostPath('xelle', '/store/xellex').kind, 'not-found');
  });

  test('sends /admin to the business workspace and passes framework paths', () => {
    assert.deepEqual(routeStoreHostPath('xelle', '/admin'), { kind: 'admin' });
    assert.deepEqual(routeStoreHostPath('xelle', '/admin/orders'), { kind: 'admin' });
    assert.deepEqual(routeStoreHostPath('xelle', '/_next/static/app.js'), { kind: 'pass' });
    assert.deepEqual(routeStoreHostPath('xelle', '/api/health/live'), { kind: 'pass' });
  });
});
