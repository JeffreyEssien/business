import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contrastRatio, isHexColor, readableTextRatio } from '../../src/lib/color.ts';
import { portfolioLooks } from '../../src/modules/portfolio/looks.ts';

test('every ready-made colour set keeps body text readable', () => {
  for (const look of portfolioLooks) {
    for (const palette of look.palettes) {
      const ratio = contrastRatio(palette.colors.text, palette.colors.background);
      assert.ok(
        ratio >= readableTextRatio,
        `${look.name} / ${palette.name}: text contrast ${ratio.toFixed(2)}`,
      );
    }
  }
});

test('every ready-made colour set uses valid hex colours', () => {
  for (const look of portfolioLooks) {
    for (const palette of look.palettes) {
      for (const value of Object.values(palette.colors)) assert.ok(isHexColor(value), value);
    }
  }
});

test('the main colour stays visible against the background', () => {
  for (const look of portfolioLooks) {
    for (const palette of look.palettes) {
      const ratio = contrastRatio(palette.colors.primary, palette.colors.background);
      assert.ok(
        ratio >= 3,
        `${look.name} / ${palette.name}: main colour contrast ${ratio.toFixed(2)}`,
      );
    }
  }
});
