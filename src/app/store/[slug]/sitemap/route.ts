import { getPublicStorefront } from '@/modules/catalog/queries';
import { storefrontUrl } from '@/modules/seo/public';

function xml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getPublicStorefront(slug);
  const paths = [
    '',
    ...(store.site?.pages ?? []).map((page) => `/${page.slug}`),
    ...store.products.map((product) => `/products/${product.slug}`),
  ];
  const urls = paths
    .map((path) => `<url><loc>${xml(storefrontUrl(store, path).toString())}</loc></url>`)
    .join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { 'content-type': 'application/xml; charset=utf-8' } },
  );
}
