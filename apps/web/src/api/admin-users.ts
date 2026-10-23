import type {
  AdminUserQuery,
  AdminUserRecord,
  CreateAdminUserInput,
  CreateOrganizationUnitInput,
  OrganizationUnitQuery,
  OrganizationUnitRecord,
  ResetAdminUserPasswordInput,
  UpdateAdminUserProfileInput,
  UpdateAdminUserStatusInput,
  UpdateOrganizationUnitInput,
} from '@ocop/shared';
import { API } from '../constants/api';
import type { UpdateAdminUserStaffAccessInput } from '../types/admin';
import type { ApiResult } from '../types/api';
import { requestJson } from './base-request';

export const adminUsersApi = {
  list: (query: AdminUserQuery) =>
    requestJson<AdminUserRecord[]>({ url: API.admin.users, params: query }),
  detail: (id: string) => requestJson<AdminUserRecord>({ url: API.admin.user(id) }),
  create: (data: CreateAdminUserInput) =>
    requestJson<AdminUserRecord>({ url: API.admin.users, method: 'POST', data }),
  update: (id: string, data: UpdateAdminUserProfileInput) =>
    requestJson<AdminUserRecord>({ url: API.admin.user(id), method: 'PUT', data }),
  access: (id: string, data: UpdateAdminUserStaffAccessInput) =>
    requestJson<AdminUserRecord>({ url: API.admin.userStaffAccess(id), method: 'PUT', data }),
  status: (id: string, data: UpdateAdminUserStatusInput) =>
    requestJson<AdminUserRecord>({ url: API.admin.userStatus(id), method: 'PUT', data }),
  resetPassword: (id: string, data: ResetAdminUserPasswordInput) =>
    requestJson<{ id: string }>({ url: API.admin.userResetPassword(id), method: 'POST', data }),
  units: (query: OrganizationUnitQuery) =>
    requestJson<OrganizationUnitRecord[]>({ url: API.admin.organizationUnits, params: query }),
  createUnit: (data: CreateOrganizationUnitInput) =>
    requestJson<OrganizationUnitRecord>({
      url: API.admin.organizationUnits,
      method: 'POST',
      data,
    }),
  updateUnit: (id: string, data: UpdateOrganizationUnitInput) =>
    requestJson<OrganizationUnitRecord>({
      url: API.admin.organizationUnit(id),
      method: 'PUT',
      data,
    }),
  listRegistrantOwners: (query: Pick<AdminUserQuery, 'page' | 'limit' | 'q'> = {}) =>
    requestJson<AdminUserRecord[]>({
      url: API.admin.users,
      params: { ...query, kind: 'REGISTRANT', isActive: true, verified: true },
    }),
};

export type AdminUserListResult = ApiResult<AdminUserRecord[]>;
