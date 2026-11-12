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

const manrope = localFont({
  src: '../../fonts/manrope-latin-wght-normal.woff2',
  weight: '200 800',
  variable: '--pf-font-manrope',
  display: 'swap',
  preload: false,
});

const spaceGrotesk = localFont({
  src: '../../fonts/space-grotesk-latin-wght-normal.woff2',
  weight: '300 700',
  variable: '--pf-font-space',
  display: 'swap',
  preload: false,
});

const ibmPlexSans = localFont({
  src: '../../fonts/ibm-plex-sans-latin-wght-normal.woff2',
  weight: '100 700',
  variable: '--pf-font-plex',
  display: 'swap',
  preload: false,
});

const archivo = localFont({
  src: '../../fonts/archivo-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--pf-font-archivo',
  display: 'swap',
  preload: false,
});

const syne = localFont({
  src: '../../fonts/syne-latin-wght-normal.woff2',
  weight: '400 800',
  variable: '--pf-font-syne',
  display: 'swap',
  preload: false,
});

const bricolage = localFont({
  src: '../../fonts/bricolage-grotesque-latin-wght-normal.woff2',
  weight: '200 800',
  variable: '--pf-font-bricolage',
  display: 'swap',
  preload: false,
});

const fraunces = localFont({
  src: '../../fonts/fraunces-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--pf-font-fraunces',
  display: 'swap',
  preload: false,
});

const playfair = localFont({
  src: '../../fonts/playfair-display-latin-wght-normal.woff2',
  weight: '400 900',
  variable: '--pf-font-playfair',
  display: 'swap',
  preload: false,
});

const dmSerif = localFont({
  src: '../../fonts/dm-serif-display-latin-400-normal.woff2',
  weight: '400',
  variable: '--pf-font-dm-serif',
  display: 'swap',
  preload: false,
});

const baskerville = localFont({
  src: '../../fonts/libre-baskerville-latin-400-normal.woff2',
  weight: '400',
  variable: '--pf-font-baskerville',
  display: 'swap',
  preload: false,
});

/** Variable-defining class names for the portfolio root element. */
export const portfolioFontVariables = [
  inter.variable,
  jetbrainsMono.variable,
  instrumentSerif.variable,
  cormorant.variable,
  manrope.variable,
  spaceGrotesk.variable,
  ibmPlexSans.variable,
  archivo.variable,
  syne.variable,
  bricolage.variable,
  fraunces.variable,
  playfair.variable,
  dmSerif.variable,
  baskerville.variable,
].join(' ');
