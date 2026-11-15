import { productsApi } from '../api';
import type { PublicProduct } from '../types/public';
import { ApiError } from './api-error';
import {
  buildCanonicalUrl,
  buildPublicProductCanonicalUrl,
  isSeoEligibleProduct,
  resolvePublicOrigin,
} from './seo';

const SITEMAP_PAGE_LIMIT = 100;
const MAX_SITEMAP_PAGES = 1000;

const DEFAULT_OG_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAABLAAAAJ2AQMAAAB1jukfAAAAA1BMVEUbQzKkijwNAAAAc0lEQVR42u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXg1zqQAB6RqMPAAAAABJRU5ErkJggg==';

export function buildDefaultOgImageResponse(): Response {
  const bytes = Uint8Array.from(atob(DEFAULT_OG_IMAGE_BASE64), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildRobotsTxt(requestOrigin?: string | null): string {
  const origin = resolvePublicOrigin(requestOrigin);
  return ['User-agent: *', 'Allow: /', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
}

export function buildRobotsTxtResponse(requestOrigin?: string | null): Response {
  return new Response(buildRobotsTxt(requestOrigin), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function fetchAllSeoEligibleProducts(
  pageSize = SITEMAP_PAGE_LIMIT,
): Promise<PublicProduct[]> {
  const seenIds = new Set<string>();
  const eligibleProducts: PublicProduct[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_SITEMAP_PAGES) {
    const result = await productsApi.list<PublicProduct>({
      page,
      limit: pageSize,
      approvedOnly: true,
    });

    const items = result.data ?? [];
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !item.id.trim()) {
        continue;
      }
      if (!isSeoEligibleProduct(item)) {
        continue;
      }
      if (seenIds.has(item.id)) {
        continue;
      }
      seenIds.add(item.id);
      eligibleProducts.push(item);
    }

    const reportedTotalPages = result.meta?.totalPages;
    if (typeof reportedTotalPages === 'number' && Number.isFinite(reportedTotalPages)) {
      totalPages = Math.max(0, Math.trunc(reportedTotalPages));
    } else if (items.length < pageSize) {
      break;
    } else {
      totalPages = page + 1;
    }

    if (totalPages === 0) {
      break;
    }

    page += 1;
  }

  return eligibleProducts;
}

export function buildSitemapXml(
  products: ReadonlyArray<{ id: string }>,
  requestOrigin?: string | null,
): string {
  const origin = resolvePublicOrigin(requestOrigin);
  const urls: string[] = [buildCanonicalUrl('/', origin), buildCanonicalUrl('/products', origin)];

  const seenUrls = new Set<string>(urls);
  const seenProductIds = new Set<string>();

  for (const product of products) {
    if (!product?.id || seenProductIds.has(product.id)) {
      continue;
    }
    seenProductIds.add(product.id);
    const productUrl = buildPublicProductCanonicalUrl(product.id, origin);
    if (!seenUrls.has(productUrl)) {
      seenUrls.add(productUrl);
      urls.push(productUrl);
    }
  }

  const urlEntries = urls
    .map((loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`)
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlEntries,
    '</urlset>',
    '',
  ].join('\n');
}

export async function buildSitemapXmlResponse(requestOrigin?: string | null): Promise<Response> {
  try {
    const eligibleProducts = await fetchAllSeoEligibleProducts();
    const xml = buildSitemapXml(eligibleProducts, requestOrigin);
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const status =
      error instanceof ApiError && error.status >= 500 && error.status < 600 ? error.status : 503;
    return new Response('Sitemap temporarily unavailable', {
      status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
}
