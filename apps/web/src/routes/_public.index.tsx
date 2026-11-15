import { createFileRoute } from '@tanstack/react-router';
import {
  buildCanonicalUrl,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_TITLE,
  isSeoEligibleProduct,
} from '../lib/seo';
import { HomePage } from '../pages/public/HomePage';
import { categoriesQueryOptions, publicProductsQueryOptions } from '../queries/common';
import type { FeaturedProduct } from '../types/public';

export const Route = createFileRoute('/_public/')({
  context: ({ context }) => ({
    requestOrigin: context.requestOrigin,
  }),
  loader: async ({ context }) => {
    const [categories, productsResult] = await Promise.all([
      context.queryClient.ensureQueryData(categoriesQueryOptions()),
      context.queryClient.ensureQueryData(
        publicProductsQueryOptions<FeaturedProduct>({
          page: 1,
          limit: 6,
          approvedOnly: true,
        }),
      ),
    ]);
    return {
      categories,
      products: (productsResult.data ?? []).filter(isSeoEligibleProduct),
      canonicalUrl: buildCanonicalUrl('/', context.requestOrigin),
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: DEFAULT_SITE_TITLE },
      { name: 'description', content: DEFAULT_SITE_DESCRIPTION },
    ],
    links: [
      {
        rel: 'canonical',
        href: loaderData?.canonicalUrl ?? buildCanonicalUrl('/'),
      },
    ],
  }),
  headers: () => ({
    'Cache-Control': 'no-store',
  }),
  component: HomePage,
});
