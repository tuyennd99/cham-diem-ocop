import type { PublicProductParams } from "../types/public";

export const queryKeys = {
  me: ['auth', 'me'] as const,
  categories: ['categories'] as const,
  publicProducts: {
    all: ['public-products'] as const,
    list: (params: PublicProductParams) => ['public-products', 'list', params] as const,
    detail: (id: string) => ['public-products', 'detail', id] as const,
  },
  myProducts: {
    all: ['my-products'] as const,
    list: ['my-products', 'list'] as const,
    detail: (id: string) => ['my-products', 'detail', id] as const,
  },
  judge: {
    all: ['judge'] as const,
    queue: ['judge', 'queue'] as const,
    evaluation: (productId: string) => ['judge', 'evaluation', productId] as const,
  },
  admin: {
    all: ['admin'] as const,
    dashboard: ['admin', 'dashboard'] as const,
    judges: ['admin', 'judges'] as const,
    assignments: ['admin', 'assignments'] as const,
    products: (page: number) => ['admin', 'products', page] as const,
    productResults: (id: string) => ['admin', 'product-results', id] as const,
  },
};
