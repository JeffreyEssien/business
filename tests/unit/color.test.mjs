import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accessibleForeground, contrastRatio, isHexColor } from '../../src/lib/color.ts';

test('black on white is the maximum contrast', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
});

test('identical colours have no contrast', () => {
  assert.equal(contrastRatio('#777777', '#777777'), 1);
});

test('picks the more readable text colour for a background', () => {
  assert.equal(accessibleForeground('#0d1117'), '#ffffff');
  assert.equal(accessibleForeground('#fafaf7'), '#111111');
});

test('only six-digit hex colours are accepted', () => {
  assert.ok(isHexColor('#3ddc97'));
  assert.ok(!isHexColor('red'));
  assert.ok(!isHexColor('#fff'));
});
