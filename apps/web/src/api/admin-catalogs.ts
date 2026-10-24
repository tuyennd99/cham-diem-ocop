import type {
  AdminCategoryDetail,
  AdminCategoryQuery,
  AdminCategoryRecord,
  CreateAdminCategoryInput,
  CreateLocalityInput,
  CreateProductGroupInput,
  LocalityQuery,
  LocalityRecord,
  ProductGroupQuery,
  ProductGroupRecord,
  UpdateAdminCategoryInput,
  UpdateLocalityInput,
  UpdateProductGroupInput,
} from '@ocop/shared';
import { API } from '../constants/api';
import { requestJson } from './base-request';

export const adminCatalogsApi = {
  groups: (query: ProductGroupQuery) =>
    requestJson<ProductGroupRecord[]>({ url: API.admin.productGroups, params: query }),
  createGroup: (data: CreateProductGroupInput) =>
    requestJson<ProductGroupRecord>({ url: API.admin.productGroups, method: 'POST', data }),
  updateGroup: (id: string, data: UpdateProductGroupInput) =>
    requestJson<ProductGroupRecord>({ url: API.admin.productGroup(id), method: 'PUT', data }),
  categories: (query: AdminCategoryQuery) =>
    requestJson<AdminCategoryRecord[]>({ url: API.admin.categories, params: query }),
  category: (id: string) =>
    requestJson<AdminCategoryDetail>({ url: API.admin.category(id) }),
  createCategory: (data: CreateAdminCategoryInput) =>
    requestJson<AdminCategoryRecord>({ url: API.admin.categories, method: 'POST', data }),
  updateCategory: (id: string, data: UpdateAdminCategoryInput) =>
    requestJson<AdminCategoryRecord>({ url: API.admin.category(id), method: 'PUT', data }),
  localities: (query: LocalityQuery) =>
    requestJson<LocalityRecord[]>({ url: API.admin.localities, params: query }),
  createLocality: (data: CreateLocalityInput) =>
    requestJson<LocalityRecord>({ url: API.admin.localities, method: 'POST', data }),
  updateLocality: (id: string, data: UpdateLocalityInput) =>
    requestJson<LocalityRecord>({ url: API.admin.locality(id), method: 'PUT', data }),
};
