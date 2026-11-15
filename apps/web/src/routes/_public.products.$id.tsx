import { createFileRoute, notFound } from '@tanstack/react-router';
import { HTTP_STATUS } from '../constants/http-status';
import { ApiError } from '../lib/api-error';
import {
  buildPublicProductCanonicalUrl,
  buildPublicProductDescription,
  buildPublicProductOgImageUrl,
  buildPublicProductTitle,
  isSeoEligibleProduct,
} from '../lib/seo';
import {
  PublicProductDetailPage,
  PublicProductNotFound,
} from '../pages/public/PublicProductDetailPage';
import { publicProductDetailQueryOptions } from '../queries/common';
import type { PublicProduct } from '../types/public';

export const Route = createFileRoute('/_public/products/$id')({
  context: ({ context }) => ({
    requestOrigin: context.requestOrigin,
  }),
  loader: async ({ context, params }) => {
    try {
      const product = await context.queryClient.ensureQueryData(
        publicProductDetailQueryOptions<PublicProduct>(params.id),
      );
      const isSeoEligible = isSeoEligibleProduct(product);
      return {
        product,
        isSeoEligible,
        canonicalUrl: buildPublicProductCanonicalUrl(product.id, context.requestOrigin),
        ogImageUrl: buildPublicProductOgImageUrl(product, context.requestOrigin),
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === HTTP_STATUS.NOT_FOUND) {
        throw notFound();
      }
      throw error;
    }
  },
  head: ({ loaderData }) => {
    const product = loaderData?.product;
    if (!product) {
      return {
        meta: [
          { title: 'Không tìm thấy sản phẩm — OCOP Đánh Giá' },
          { name: 'robots', content: 'noindex' },
        ],
      };
    }

    const title = buildPublicProductTitle(product);
    if (!loaderData?.isSeoEligible) {
      return {
        meta: [{ title }, { name: 'robots', content: 'noindex' }],
      };
    }

    const description = buildPublicProductDescription(product);
    const canonicalUrl = loaderData.canonicalUrl;
    const ogImageUrl = loaderData.ogImageUrl;

    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: canonicalUrl },
        { property: 'og:image', content: ogImageUrl },
      ],
      links: [
        {
          rel: 'canonical',
          href: canonicalUrl,
        },
      ],
    };
  },
  headers: ({ loaderData }): Record<string, string> => {
    if (!loaderData?.isSeoEligible) {
      return {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      };
    }
    return {
      'Cache-Control': 'no-store',
    };
  },
  notFoundComponent: PublicProductNotFound,
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  return <PublicProductDetailPage id={id} />;
}
