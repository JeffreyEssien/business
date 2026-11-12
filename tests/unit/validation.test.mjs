// Fast, dependency-free checks for the trust-boundary validators.
// Node runs the TypeScript sources directly (type stripping), so these tests
// exercise the same code the Server Actions use. The database repeats every
// rule; these tests protect the user-facing messages and normalization.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { normalizePlanInput } from '../../src/modules/billing/validation.ts';
import {
  catalogErrorMessage,
  validateCategory,
  validateProduct,
} from '../../src/modules/catalog/validation.ts';
import {
  commerceErrorMessage,
  parseCart,
  validateCheckout,
} from '../../src/modules/commerce/validation.ts';

const productId = '3f1c2b7a-9d4e-4a8b-8c1d-2e3f4a5b6c7d';
const otherProductId = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

describe('normalizePlanInput', () => {
  const valid = {
    plan: 'growth',
    name: ' Growth ',
    description: 'For growing stores',
    price: '15000.555',
    currency: 'ngn',
    billingInterval: 'MONTHLY',
    sortOrder: '1',
    isPublic: 'on',
  };

  test('normalizes a valid plan', () => {
    const { input, error } = normalizePlanInput(form(valid));
    assert.equal(error, undefined);
    assert.deepEqual(input, {
      slug: 'growth',
      name: 'Growth',
      description: 'For growing stores',
      price: 15000.56,
      currency: 'NGN',
      billingInterval: 'MONTHLY',
      isPublic: true,
      sortOrder: 1,
    });
  });

  test('treats a missing visibility checkbox as hidden', () => {
    const { isPublic, ...rest } = valid;
    assert.equal(isPublic, 'on');
    assert.equal(normalizePlanInput(form(rest)).input?.isPublic, false);
  });

  for (const [field, value] of [
    ['plan', ''],
    ['name', ''],
    ['price', '-1'],
    ['price', 'abc'],
    ['currency', 'NAIRA'],
    ['billingInterval', 'WEEKLY'],
    ['sortOrder', '1.5'],
    ['sortOrder', '1001'],
  ]) {
    test(`rejects ${field}=${JSON.stringify(value)}`, () => {
      const result = normalizePlanInput(form({ ...valid, [field]: value }));
      assert.equal(result.input, undefined);
      assert.ok(result.error);
    });
  }
});

describe('validateCategory', () => {
  test('lowercases the handle and defaults to active', () => {
    const { input } = validateCategory(form({ name: 'Shoes', slug: ' Mens-Shoes ' }));
    assert.equal(input?.slug, 'mens-shoes');
    assert.equal(input?.status, 'ACTIVE');
  });

  test('rejects handles with spaces or invalid statuses', () => {
    assert.ok(validateCategory(form({ name: 'Shoes', slug: 'mens shoes' })).error);
    assert.ok(validateCategory(form({ name: 'Shoes', slug: 'shoes', status: 'LIVE' })).error);
  });
});

describe('validateProduct', () => {
  const valid = {
    name: 'Linen shirt',
    slug: 'linen-shirt',
    price: '12000',
    compareAtPrice: '15000',
    stockQuantity: '4',
    status: 'ACTIVE',
    categoryIds: [productId, otherProductId],
    trackInventory: 'on',
  };

  test('accepts a valid product and keeps every category', () => {
    const { input, error } = validateProduct(form(valid));
    assert.equal(error, undefined);
    assert.equal(input?.price, 12000);
    assert.equal(input?.compareAtPrice, 15000);
    assert.equal(input?.trackInventory, true);
    assert.deepEqual(input?.categoryIds, [productId, otherProductId]);
  });

  test('treats an empty compare-at price as none', () => {
    assert.equal(
      validateProduct(form({ ...valid, compareAtPrice: '' })).input?.compareAtPrice,
      null,
    );
  });

  test('rejects a compare-at price below the selling price', () => {
    assert.ok(validateProduct(form({ ...valid, compareAtPrice: '100' })).error);
  });

  test('rejects fractional or negative stock and negative prices', () => {
    assert.ok(validateProduct(form({ ...valid, stockQuantity: '1.5' })).error);
    assert.ok(validateProduct(form({ ...valid, stockQuantity: '-1' })).error);
    assert.ok(validateProduct(form({ ...valid, price: '-5' })).error);
  });
});

describe('catalogErrorMessage', () => {
  test('maps known database outcomes to friendly messages', () => {
    assert.match(catalogErrorMessage('23505'), /already in use/);
    assert.match(catalogErrorMessage(undefined, 'USAGE_LIMIT_EXCEEDED'), /product limit/);
    assert.match(catalogErrorMessage(undefined, 'FORBIDDEN'), /permission/);
    assert.match(catalogErrorMessage(), /could not be saved/);
  });
});

describe('parseCart', () => {
  test('accepts JSON or already-parsed lines', () => {
    const lines = [{ productId, quantity: 2 }];
    assert.deepEqual(parseCart(JSON.stringify(lines)), lines);
    assert.deepEqual(parseCart(lines), lines);
  });

  test('rejects empty, duplicate, malformed, and out-of-range carts', () => {
    assert.equal(parseCart('[]'), null);
    assert.equal(parseCart('not json'), null);
    assert.equal(parseCart([{ productId: 'abc', quantity: 1 }]), null);
    assert.equal(parseCart([{ productId, quantity: 0 }]), null);
    assert.equal(parseCart([{ productId, quantity: 100 }]), null);
    assert.equal(
      parseCart([
        { productId, quantity: 1 },
        { productId, quantity: 2 },
      ]),
      null,
    );
    const tooMany = Array.from({ length: 51 }, () => ({ productId, quantity: 1 }));
    assert.equal(parseCart(tooMany), null);
  });
});

describe('validateCheckout', () => {
  const valid = {
    cart: JSON.stringify([{ productId, quantity: 1 }]),
    name: 'Ada Obi',
    email: ' ADA@Example.com ',
    country: '',
    paymentChoice: 'bank_transfer',
  };

  test('normalizes contact details and defaults the country', () => {
    const { input } = validateCheckout(form(valid));
    assert.equal(input?.customer.email, 'ada@example.com');
    assert.equal(input?.address.country, 'NG');
    assert.equal(input?.paymentChoice, 'BANK_TRANSFER');
    assert.equal(input?.shippingRate, null);
  });

  test('rejects unknown payment choices and malformed delivery ids', () => {
    assert.ok(validateCheckout(form({ ...valid, paymentChoice: 'CASH' })).error);
    assert.ok(validateCheckout(form({ ...valid, shippingRate: 'zone-1' })).error);
    assert.ok(validateCheckout(form({ ...valid, name: '  ' })).error);
  });
});

describe('commerceErrorMessage', () => {
  test('finds the stable code inside a database message', () => {
    assert.match(commerceErrorMessage('ERROR: PRODUCT_OUT_OF_STOCK (P0001)'), /no longer in stock/);
    assert.match(commerceErrorMessage('something else'), /could not complete/);
  });
});
