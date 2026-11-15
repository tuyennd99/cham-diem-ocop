import { createFileRoute } from '@tanstack/react-router';
import { DEFAULT_PAGE_SIZE } from '../constants/consts';
import { normalizePublicProductsSearch, parsePublicProductsSearch } from '../lib/admin-search';
import {
  buildCatalogCanonicalUrl,
  isCatalogSearchFiltered,
  PUBLIC_CATALOG_DESCRIPTION,
  PUBLIC_CATALOG_TITLE,
} from '../lib/seo';
import { PublicCatalogPage } from '../pages/public/PublicCatalogPage';
import { categoriesQueryOptions, publicProductsQueryOptions } from '../queries/common';
import type { PublicProduct } from '../types/public';

export const Route = createFileRoute('/_public/products/')({
  validateSearch: parsePublicProductsSearch,
  loaderDeps: ({ search }) => ({
    page: search.page ?? 1,
    limit: search.limit ?? DEFAULT_PAGE_SIZE,
    q: search.q,
    categoryId: search.categoryId,
  }),
  loader: async ({ context, deps }) => {
    const [, productsResult] = await Promise.all([
      context.queryClient.prefetchQuery(categoriesQueryOptions()),
      context.queryClient.ensureQueryData(
        publicProductsQueryOptions<PublicProduct>({
          page: deps.page,
          limit: deps.limit,
          categoryId: deps.categoryId || undefined,
          q: deps.q || undefined,
          approvedOnly: true,
        }),
      ),
    ]);

    const noindex = isCatalogSearchFiltered(deps, DEFAULT_PAGE_SIZE);
    const canonicalUrl = buildCatalogCanonicalUrl({ page: deps.page }, context.requestOrigin);

    return {
      page: deps.page,
      limit: deps.limit,
      q: deps.q,
      categoryId: deps.categoryId,
      total: productsResult.meta?.total ?? productsResult.data.length,
      totalPages: productsResult.meta?.totalPages ?? 1,
      canonicalUrl,
      noindex,
    };
  },
  head: ({ loaderData }) => {
    const page = loaderData?.page ?? 1;
    const title = page > 1 ? `Tra cứu sản phẩm OCOP — Trang ${page}` : PUBLIC_CATALOG_TITLE;
    const description =
      page > 1
        ? `Danh sách sản phẩm OCOP đã được Chủ trì duyệt — Trang ${page}.`
        : PUBLIC_CATALOG_DESCRIPTION;
    const canonicalUrl = loaderData?.canonicalUrl ?? buildCatalogCanonicalUrl({ page });

    return {
      meta: [
        { title },
        { name: 'description', content: description },
        ...(loaderData?.noindex ? [{ name: 'robots', content: 'noindex, follow' }] : []),
      ],
      links: [
        {
          rel: 'canonical',
          href: canonicalUrl,
        },
      ],
    };
  },
  headers: ({ loaderData }) => ({
    'Cache-Control': 'no-store',
    ...(loaderData?.noindex ? { 'X-Robots-Tag': 'noindex' } : {}),
  }),
  component: PublicCatalogRoute,
});

function PublicCatalogRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PublicCatalogPage
      search={search}
      onSearchChange={(next) => {
        void navigate({
          search: normalizePublicProductsSearch(next, DEFAULT_PAGE_SIZE),
        });
      }}
    />
  );
}
