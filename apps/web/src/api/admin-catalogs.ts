import type {
  AdminCategoryDetail,
  AdminCategoryQuery,
  AdminCategoryRecord,
  CreateAdminCategoryInput,
  CreateLocalityInput,
  LocalityQuery,
  LocalityRecord,
  UpdateAdminCategoryInput,
  UpdateLocalityInput,
} from '@ocop/shared';
import { API } from '../constants/api';
import { requestJson } from './base-request';

export const adminCatalogsApi = {
  categories: (query: AdminCategoryQuery) =>
    requestJson<AdminCategoryRecord[]>({ url: API.admin.categories, params: query }),
  category: (id: string) => requestJson<AdminCategoryDetail>({ url: API.admin.category(id) }),
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
