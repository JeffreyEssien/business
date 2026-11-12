import localFont from 'next/font/local';

/*
 * Self-hosted open-licence fonts for portfolio template styles
 * (docs/plans/portfolio-templates.md §3). Files and their SIL OFL licences live in
 * src/fonts. Each font only defines a CSS variable and is not preloaded, so a browser
 * downloads a file only when the active template's styles actually use it.
 */
const inter = localFont({
  src: '../../fonts/inter-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--pf-font-inter',
  display: 'swap',
  preload: false,
});

const jetbrainsMono = localFont({
  src: '../../fonts/jetbrains-mono-latin-wght-normal.woff2',
  weight: '100 800',
  variable: '--pf-font-mono',
  display: 'swap',
  preload: false,
});

const instrumentSerif = localFont({
  src: '../../fonts/instrument-serif-latin-400-normal.woff2',
  weight: '400',
  variable: '--pf-font-instrument',
  display: 'swap',
  preload: false,
});

const cormorant = localFont({
  src: '../../fonts/cormorant-garamond-latin-wght-normal.woff2',
  weight: '300 700',
  variable: '--pf-font-cormorant',
  display: 'swap',
  preload: false,
});

/** Variable-defining class names for the portfolio root element. */
export const portfolioFontVariables = [
  inter.variable,
  jetbrainsMono.variable,
  instrumentSerif.variable,
  cormorant.variable,
].join(' ');
