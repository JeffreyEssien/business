import { getPublicStorefront } from '@/modules/catalog/queries';
import { storefrontUrl } from '@/modules/seo/public';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getPublicStorefront(slug);
  const searchable = store.site?.seo?.allowSearchListing ?? false;
  const body = searchable
    ? `User-agent: *\nAllow: /\nSitemap: ${storefrontUrl(store, '/sitemap')}\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
