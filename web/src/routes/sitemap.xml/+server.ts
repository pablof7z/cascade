import type { RequestHandler } from './$types';
import { fetchSitemapMarkets } from '$lib/server/cascade';

type SitemapPage = {
  loc: string;
  priority: string;
  changefreq: string;
  lastmod?: string;
};

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export const GET: RequestHandler = async ({ locals, url }) => {
  const origin = url.origin;

  const staticPages: SitemapPage[] = [
    { loc: origin, priority: '1.0', changefreq: 'hourly' },
    { loc: `${origin}/markets`, priority: '0.9', changefreq: 'hourly' },
    { loc: `${origin}/about`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${origin}/how-it-works`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${origin}/leaderboard`, priority: '0.6', changefreq: 'daily' }
  ];

  const markets = await fetchSitemapMarkets(500, { edition: locals.cascadeEdition });
  const marketPages: SitemapPage[] = markets.map((market) => ({
    loc: `${origin}/market/${encodeURIComponent(market.slug)}`,
    priority: '0.9',
    changefreq: 'hourly',
    ...(market.createdAt
      ? { lastmod: new Date(market.createdAt * 1000).toISOString().split('T')[0] }
      : {})
  }));

  const allPages = [...staticPages, ...marketPages];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${escapeXml(page.loc)}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>${page.lastmod ? `
    <lastmod>${page.lastmod}</lastmod>` : ''}
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml',
      'cache-control': 'public, max-age=3600, s-maxage=86400'
    }
  });
};
