import { notFound } from 'next/navigation';
import { LookForm } from '@/components/portfolio/look-form';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { isHexColor } from '@/lib/color';
import { getSiteEditor } from '@/modules/content/queries';
import { lookByStyle, portfolioLooks, type Palette } from '@/modules/portfolio/looks';

export const metadata = { title: 'Colours & look' };
export default async function PortfolioLookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const editor = await getSiteEditor(slug);
  if (editor.configuration.siteKind !== 'PORTFOLIO') notFound();
  const tokens = editor.configuration.theme.tokens;
  const fallback = (lookByStyle(tokens.templateStyle) ?? portfolioLooks[0]).palettes[0].colors;
  // Older themes may lack a colour; fall back to the look's first set for that colour only.
  const pick = (key: keyof Palette) => {
    const value = tokens[key as keyof typeof tokens];
    return isHexColor(value) ? value.toLowerCase() : fallback[key];
  };
  const currentPalette: Palette = {
    background: pick('background'),
    text: pick('text'),
    primary: pick('primary'),
    accent: pick('accent'),
    secondary: pick('secondary'),
  };
  return (
    <main className="tenant-home">
      <PageHeader
        eyebrow="YOUR PAGE"
        title="Colours & look"
        description="Choose how your portfolio looks. Your words, photos, and entries stay exactly as they are."
        action={
          <ButtonLink variant="secondary" href={`/t/${slug}/design`}>
            ← Back to your page
          </ButtonLink>
        }
      />
      <LookForm
        slug={slug}
        currentStyle={tokens.templateStyle ?? ''}
        currentPalette={currentPalette}
      />
    </main>
  );
}
