import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cloudinaryImage, cloudinarySrcSet } from '../../src/lib/cloudinary/delivery.ts';

const original =
  'https://res.cloudinary.com/demo/image/upload/v1/businesscare/tenants/t/portfolio/a.jpg';

test('adds format, quality, and width to Cloudinary upload URLs', () => {
  assert.equal(
    cloudinaryImage(original, { width: 800 }),
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800,c_limit/v1/businesscare/tenants/t/portfolio/a.jpg',
  );
});

test('fixed-shape crops keep the subject with automatic gravity', () => {
  assert.match(
    cloudinaryImage(original, { width: 600, aspect: 4 / 3 }),
    /w_600,ar_1\.333,c_fill,g_auto\//,
  );
});

test('leaves other URLs untouched', () => {
  assert.equal(
    cloudinaryImage('https://example.com/a.jpg', { width: 800 }),
    'https://example.com/a.jpg',
  );
  assert.equal(cloudinarySrcSet('https://example.com/a.jpg', [400]), undefined);
});

test('builds a srcset for each width', () => {
  assert.equal(cloudinarySrcSet(original, [400, 800])?.split(', ').length, 2);
});
