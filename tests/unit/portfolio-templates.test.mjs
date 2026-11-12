import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';
import {
  migrationJson,
  TEMPLATE_MIGRATION,
  templateRows,
} from '../../scripts/generate-portfolio-templates.mjs';
import { embedFromUrl, normalizeEmbedUrl } from '../../src/modules/portfolio/embeds.ts';
import { entryTypes, partEntryType, partLooks } from '../../src/modules/portfolio/entries.ts';
import { samplePhotos } from '../../src/modules/portfolio/sample-photos.ts';
import { portfolioTemplateLibrary } from '../../src/modules/portfolio/template-library.ts';

const PARTS_MIGRATION = 'supabase/migrations/202611120002_portfolio_parts.sql';

/** Reads `when 'type' then array[...]` pairs from the database variant allow-list. */
function databaseVariants(sql) {
  const body = sql.slice(sql.indexOf('portfolio_section_variants(section_type text)'));
  const variants = {};
  for (const match of body.matchAll(/when '([a-z]+)' then array\[([^\]]+)\]/g)) {
    if (match[1] in variants) break;
    variants[match[1]] = [...match[2].matchAll(/'([a-z-]+)'/g)].map((value) => value[1]);
  }
  return variants;
}

describe('portfolio template library', () => {
  test('the generated migration matches the library exactly', async () => {
    const sql = await readFile(TEMPLATE_MIGRATION, 'utf8');
    assert.deepEqual(
      migrationJson(sql),
      JSON.parse(JSON.stringify(templateRows())),
      'Run node scripts/generate-portfolio-templates.mjs',
    );
  });

  test('has 24 templates, two or more per audience, each with its own style', () => {
    assert.equal(portfolioTemplateLibrary.length, 24);
    const keys = new Set(portfolioTemplateLibrary.map((t) => t.key));
    const styles = new Set(portfolioTemplateLibrary.map((t) => t.tokens.templateStyle));
    assert.equal(keys.size, 24);
    assert.equal(styles.size, 24);
    const groups = new Map();
    for (const t of portfolioTemplateLibrary)
      groups.set(t.audienceGroup, (groups.get(t.audienceGroup) ?? 0) + 1);
    assert.equal(groups.size, 12);
    for (const [group, count] of groups) assert.ok(count >= 2, group);
    for (const t of portfolioTemplateLibrary) {
      assert.match(t.key, /^[a-z][a-z0-9-]{1,47}$/);
      assert.match(t.tokens.templateStyle, /^pf-[a-z-]+$/);
      assert.ok(t.description.length <= 300 && t.audience.length <= 80 && t.name.length <= 80);
    }
  });

  test('page part layouts match the database allow-list', async () => {
    const variants = databaseVariants(await readFile(PARTS_MIGRATION, 'utf8'));
    assert.deepEqual(
      Object.keys(variants).sort(),
      Object.keys(partLooks).sort(),
      'part types differ between the database and the builder',
    );
    for (const [type, looks] of Object.entries(partLooks))
      assert.deepEqual(
        looks.map((look) => look.value),
        variants[type],
        type,
      );
  });

  test('every template uses known parts, opens with the hero, and keeps email contact', () => {
    for (const t of portfolioTemplateLibrary) {
      assert.equal(t.sections[0].type, 'hero', t.key);
      assert.ok(
        t.sections.some((s) => s.type === 'contact'),
        `${t.key} needs a contact part`,
      );
      const keys = new Set();
      for (const section of t.sections) {
        assert.ok(!keys.has(section.key), `${t.key}: duplicate part key ${section.key}`);
        keys.add(section.key);
        const looks = partLooks[section.type];
        assert.ok(looks, `${t.key}: unknown part ${section.type}`);
        assert.ok(
          looks.some((look) => look.value === section.variant),
          `${t.key}: ${section.type} has no look ${section.variant}`,
        );
        for (const field of section.sampleFields)
          assert.ok(field in section.content, `${t.key}.${section.key}: ${field} is not content`);
        const href = section.content.primaryCta?.href;
        if (typeof href === 'string' && href.startsWith('#'))
          assert.ok(
            keys.has(href.slice(1)) || t.sections.some((s) => s.key === href.slice(1)),
            `${t.key}: button goes to missing part ${href}`,
          );
      }
    }
  });

  test('sample photos exist, have descriptions, and only sit where they are shown', async () => {
    // The database accepts only this path shape for bundled sample photos.
    const shape = /^\/portfolio-samples\/[a-z0-9]+(-[a-z0-9]+)*\.webp$/;
    const used = new Set();
    for (const t of portfolioTemplateLibrary) {
      const photos = [
        ...t.sections.flatMap((section) => {
          if (!section.photo) return [];
          if (section.type === 'hero')
            assert.ok(['split', 'image-overlay'].includes(section.variant), `${t.key} hero`);
          else assert.match(section.variant, /^photo-/, `${t.key} ${section.key} photo layout`);
          return [section.photo];
        }),
        ...t.items.flatMap((item) => [
          ...(item.cover ? [item.cover] : []),
          ...(item.gallery ?? []),
        ]),
      ];
      for (const photo of photos) {
        assert.match(photo.src, shape, t.key);
        assert.ok(photo.alt.length > 0 && photo.alt.length <= 300, `${t.key} ${photo.src} alt`);
        used.add(photo.src);
      }
      for (const item of t.items)
        if (item.gallery) assert.equal(item.type, 'PROJECT', `${t.key} album on ${item.type}`);
    }
    await Promise.all([...used].map((src) => access(`public${src}`)));
    // Every bundled photo is used somewhere, so the repository carries no dead weight.
    const bundled = Object.keys(samplePhotos).map((name) => `/portfolio-samples/${name}.webp`);
    assert.deepEqual(
      bundled.filter((src) => !used.has(src)),
      [],
      'remove unused sample photos',
    );
  });

  test('every list part has example entries, and every entry is a known kind', () => {
    const columns = [
      'title',
      'subtitle',
      'summary',
      'role',
      'outcome',
      'link_url',
      'source_url',
      'tags',
    ];
    const camel = { link_url: 'linkUrl', source_url: 'sourceUrl' };
    for (const t of portfolioTemplateLibrary) {
      for (const item of t.items) {
        assert.ok(entryTypes.includes(item.type), `${t.key}: unknown entry kind ${item.type}`);
        assert.ok(item.title.length >= 1 && item.title.length <= 160);
        for (const field of item.sampleFields) {
          assert.ok(columns.includes(field), `${t.key}: unknown example field ${field}`);
          const value = item[camel[field] ?? field];
          assert.ok(
            Array.isArray(value) ? value.length > 0 : Boolean(value),
            `${t.key} "${item.title}": example field ${field} is empty`,
          );
        }
        for (const url of [item.linkUrl, item.sourceUrl].filter(Boolean))
          assert.match(url, /^https:\/\/\S+$/);
        if (item.type === 'LINK') assert.ok(item.linkUrl, `${t.key}: downloads need a link`);
      }
      for (const section of t.sections) {
        const kind = partEntryType[section.type];
        if (kind)
          assert.ok(
            t.items.some((item) => item.type === kind),
            `${t.key}: ${section.type} part has no example ${kind} entries`,
          );
      }
      const usedKinds = new Set(t.sections.map((s) => partEntryType[s.type]).filter(Boolean));
      for (const item of t.items)
        assert.ok(usedKinds.has(item.type), `${t.key}: ${item.type} entries have no part`);
    }
  });
});

describe('song and video links', () => {
  test('turns share links into players', () => {
    assert.equal(
      embedFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10').src,
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    assert.equal(
      embedFromUrl('youtu.be/dQw4w9WgXcQ').src,
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    assert.equal(
      embedFromUrl('https://open.spotify.com/intl-fr/track/4uLU6hMCjMI75M1A2tKUQC?si=x').src,
      'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC',
    );
    assert.equal(
      embedFromUrl('https://vimeo.com/76979871').src,
      'https://player.vimeo.com/video/76979871?dnt=1',
    );
    assert.equal(
      embedFromUrl('https://audiomack.com/some-artist/song/some-song').src,
      'https://audiomack.com/embed/song/some-artist/some-song',
    );
    assert.match(
      embedFromUrl('https://soundcloud.com/artist/track').src,
      /^https:\/\/w\.soundcloud\.com\/player\/\?url=https%3A%2F%2Fsoundcloud\.com%2Fartist%2Ftrack/,
    );
    assert.equal(
      embedFromUrl('https://music.apple.com/ng/album/name/123?i=456').src,
      'https://embed.music.apple.com/ng/album/name/123?i=456',
    );
  });

  test('shows Boomplay as a link because it has no public player address', () => {
    const embed = embedFromUrl('https://www.boomplay.com/songs/12345');
    assert.equal(embed.provider, 'boomplay');
    assert.equal(embed.src, null);
  });

  test('refuses other sites and malformed links', () => {
    for (const url of [
      'https://evil.example/watch?v=dQw4w9WgXcQ',
      'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=short',
      'https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ',
      'javascript:alert(1)',
      'https://open.spotify.com/user/x',
    ])
      assert.equal(embedFromUrl(url), null, url);
    assert.equal(normalizeEmbedUrl('https://evil.example/x'), '');
    assert.equal(
      normalizeEmbedUrl('youtube.com/watch?v=dQw4w9WgXcQ'),
      'https://youtube.com/watch?v=dQw4w9WgXcQ',
    );
  });
});
