/**
 * Portfolio looks (template styles) and their ready-made colour sets. Every set keeps body
 * text at WCAG AA contrast against its background (tests/unit/portfolio-looks.test.mjs);
 * the database repeats that check for custom colours.
 */
// The .ts extension lets Node's test runner load this module without a bundler.
import { portfolioTemplateLibrary } from './template-library.ts';

export type Palette = {
  background: string;
  text: string;
  primary: string;
  accent: string;
  secondary: string;
};

export type PortfolioLook = {
  style: string;
  name: string;
  description: string;
  palettes: Array<{ name: string; colors: Palette }>;
};

const handMadeLooks: PortfolioLook[] = [
  {
    style: 'pf-terminal',
    name: 'Terminal',
    description: 'Code-like and dark. Quick to scan for skills and projects.',
    palettes: [
      {
        name: 'Green on night',
        colors: {
          background: '#0d1117',
          text: '#e6edf3',
          primary: '#3ddc97',
          accent: '#58c4dc',
          secondary: '#8b949e',
        },
      },
      {
        name: 'Amber',
        colors: {
          background: '#14110d',
          text: '#f3ead8',
          primary: '#ffb547',
          accent: '#ff7b54',
          secondary: '#a39684',
        },
      },
      {
        name: 'Deep sea',
        colors: {
          background: '#002b36',
          text: '#eee8d5',
          primary: '#2aa198',
          accent: '#e0b23a',
          secondary: '#93a1a1',
        },
      },
      {
        name: 'Daylight',
        colors: {
          background: '#fbfbf8',
          text: '#1f2328',
          primary: '#0a7e4b',
          accent: '#0969da',
          secondary: '#57606a',
        },
      },
    ],
  },
  {
    style: 'pf-case-study',
    name: 'Case study',
    description: 'Airy, with a large serif headline. Built for telling the story of your work.',
    palettes: [
      {
        name: 'Paper and coral',
        colors: {
          background: '#fafaf7',
          text: '#1d1d1f',
          primary: '#1d1d1f',
          accent: '#e5482a',
          secondary: '#6e6e73',
        },
      },
      {
        name: 'Ink and cobalt',
        colors: {
          background: '#f7f7f5',
          text: '#111318',
          primary: '#111318',
          accent: '#2f5bea',
          secondary: '#5f6370',
        },
      },
      {
        name: 'Sand and olive',
        colors: {
          background: '#f4efe6',
          text: '#2b2a24',
          primary: '#2b2a24',
          accent: '#5f6d22',
          secondary: '#6d6a5f',
        },
      },
      {
        name: 'Night',
        colors: {
          background: '#121214',
          text: '#f1f1ee',
          primary: '#f1f1ee',
          accent: '#ff7a59',
          secondary: '#a3a3a8',
        },
      },
    ],
  },
  {
    style: 'pf-darkroom',
    name: 'Darkroom',
    description: 'Gallery-dark and image-first, with an elegant serif.',
    palettes: [
      {
        name: 'Gold on charcoal',
        colors: {
          background: '#121110',
          text: '#f2ede4',
          primary: '#c9a46a',
          accent: '#c9a46a',
          secondary: '#8f8577',
        },
      },
      {
        name: 'Silver',
        colors: {
          background: '#101112',
          text: '#ecedee',
          primary: '#c7ccd1',
          accent: '#c7ccd1',
          secondary: '#8a8f94',
        },
      },
      {
        name: 'Deep green',
        colors: {
          background: '#0f1714',
          text: '#e9efe9',
          primary: '#b8c9a3',
          accent: '#b8c9a3',
          secondary: '#8a9a8f',
        },
      },
      {
        name: 'Gallery white',
        colors: {
          background: '#f6f2ec',
          text: '#1c1a17',
          primary: '#7a5c30',
          accent: '#7a5c30',
          secondary: '#6f675c',
        },
      },
    ],
  },
  {
    style: 'pf-one-page',
    name: 'One page',
    description: 'A crisp, printable CV for recruiters.',
    palettes: [
      {
        name: 'Navy',
        colors: {
          background: '#ffffff',
          text: '#1d2733',
          primary: '#1f3a64',
          accent: '#9a6416',
          secondary: '#5b6b82',
        },
      },
      {
        name: 'Charcoal and teal',
        colors: {
          background: '#ffffff',
          text: '#1f2328',
          primary: '#0f6e6e',
          accent: '#a14d07',
          secondary: '#57606a',
        },
      },
      {
        name: 'Burgundy',
        colors: {
          background: '#fffdfa',
          text: '#231b1b',
          primary: '#7a1f3d',
          accent: '#8a5f1a',
          secondary: '#6b5b5b',
        },
      },
      {
        name: 'Forest',
        colors: {
          background: '#fbfcfa',
          text: '#18231d',
          primary: '#1f5e3b',
          accent: '#7c5100',
          secondary: '#56625a',
        },
      },
    ],
  },
];

/**
 * Every other template's look comes from the template library: its own colours first,
 * then its extra ready-made sets. Contrast for all of them is checked by unit tests.
 */
const libraryLooks: PortfolioLook[] = portfolioTemplateLibrary
  .filter((template) => !handMadeLooks.some((look) => look.style === template.tokens.templateStyle))
  .map((template) => {
    const { background, text, primary, accent, secondary } = template.tokens;
    return {
      style: template.tokens.templateStyle,
      name: template.name,
      description: template.description,
      palettes: [
        { name: 'Original', colors: { background, text, primary, accent, secondary } },
        ...template.palettes,
      ],
    };
  });

export const portfolioLooks: PortfolioLook[] = [...handMadeLooks, ...libraryLooks];

export function lookByStyle(style: string | undefined) {
  return portfolioLooks.find((look) => look.style === style);
}

/**
 * The looks an owner may pick: those whose template Super Admin offers, plus the owner's
 * current look so it never disappears from under them. A null list means the offer could
 * not be read, so every look is shown rather than none.
 */
export function offeredLooks(activeStyles: readonly string[] | null, currentStyle = '') {
  if (!activeStyles) return portfolioLooks;
  const looks = portfolioLooks.filter(
    (look) => activeStyles.includes(look.style) || look.style === currentStyle,
  );
  return looks.length > 0 ? looks : portfolioLooks;
}

/** Template styles suggested for one kind of work (an audience group). */
export function stylesForAudience(group: string) {
  return portfolioTemplateLibrary
    .filter((template) => template.audienceGroup === group)
    .map((template) => template.tokens.templateStyle);
}
