import type {
  AdminCategoryQuery,
  AdminCriteriaSetQuery,
  AdminEvaluationQuery,
  AdminProductQuery,
  AdminUserQuery,
  LocalityQuery,
  OrganizationUnitQuery,
  ProductGroupQuery,
  PublicLocalityQuery,
} from '@ocop/shared';
import type { PublicProductParams } from '../types/public';

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
  },
  adminProducts: {
    all: ['admin-products'] as const,
    list: (mode: 'products' | 'registrations', canManage: boolean, query: AdminProductQuery) =>
      ['admin-products', mode, canManage, 'list', query] as const,
    detail: (mode: 'products' | 'registrations', canManage: boolean, id: string) =>
      ['admin-products', mode, canManage, 'detail', id] as const,
    results: (canManage: boolean, id: string) =>
      ['admin-products', 'results', canManage, id] as const,
  },
  localities: {
    all: ['localities'] as const,
    list: (query: Pick<PublicLocalityQuery, 'page' | 'limit' | 'q'>) =>
      ['localities', 'list', query] as const,
  },
  adminUsers: {
    users: {
      all: ['admin-users'] as const,
      list: (query: AdminUserQuery) => ['admin-users', 'list', query] as const,
      detail: (id: string) => ['admin-users', 'detail', id] as const,
    },
    units: {
      all: ['admin-organization-units'] as const,
      list: (query: OrganizationUnitQuery) => ['admin-organization-units', 'list', query] as const,
    },
    owners: (query: Pick<AdminUserQuery, 'page' | 'limit' | 'q'>) =>
      ['admin-users', 'owners', query] as const,
  },
  adminCatalogs: {
    groups: {
      all: ['admin-product-groups'] as const,
      list: (query: ProductGroupQuery) => ['admin-product-groups', 'list', query] as const,
    },
    categories: {
      all: ['admin-categories'] as const,
      list: (query: AdminCategoryQuery) => ['admin-categories', 'list', query] as const,
      detail: (id: string) => ['admin-categories', 'detail', id] as const,
    },
    localities: {
      all: ['admin-localities'] as const,
      list: (query: LocalityQuery) => ['admin-localities', 'list', query] as const,
    },
  },
  scoringPrint: {
    criteriaSets: {
      all: ['admin-criteria-sets'] as const,
      list: (query: AdminCriteriaSetQuery) => ['admin-criteria-sets', 'list', query] as const,
      detail: (id: string) => ['admin-criteria-sets', 'detail', id] as const,
      printData: (id: string) => ['admin-criteria-sets', 'print-data', id] as const,
    },
    evaluations: {
      all: ['admin-evaluations'] as const,
      list: (query: AdminEvaluationQuery) => ['admin-evaluations', 'list', query] as const,
      printData: (id: string) => ['admin-evaluations', 'print-data', id] as const,
    },
    judgeEvaluationPrintData: (productId: string) =>
      ['judge', 'evaluation-print-data', productId] as const,
    registrationPrintData: (mode: 'admin' | 'owner', productId: string) =>
      ['print-data', 'registration', mode, productId] as const,
    resultsPrintData: (mode: 'admin' | 'owner', productId: string) =>
      ['print-data', 'results', mode, productId] as const,
  },
};
