import type {
  AdminReportFilterQuery,
  AdminReportQuery,
  RegistrationReportResponse,
  ResultsReportResponse,
} from '@ocop/shared';
import { API } from '../constants/api';
import { DEFAULT_PAGE_SIZE } from '../constants/consts';
import type {
  AdminDashboard,
  AdminJudge,
  AdminProduct,
  Assignment,
  AssignmentInput,
  CreateJudgeInput,
  DeactivatedJudge,
  ResetJudgePasswordInput,
  UpdateJudgeInput,
} from '../types/admin';
import { requestJson } from './base-request';

export const adminApi = {
  dashboard: (query?: AdminReportFilterQuery) =>
    requestJson<AdminDashboard>({ url: API.admin.dashboard, params: query }),
  registrationsReport: (query: AdminReportQuery) =>
    requestJson<RegistrationReportResponse>({
      url: API.admin.reportsRegistrations,
      params: query,
    }),
  resultsReport: (query: AdminReportQuery) =>
    requestJson<ResultsReportResponse>({
      url: API.admin.reportsResults,
      params: query,
    }),
  judges: () => requestJson<AdminJudge[]>({ url: API.admin.judges }),
  createJudge: (data: CreateJudgeInput) =>
    requestJson<AdminJudge>({ url: API.admin.judges, method: 'POST', data }),
  updateJudge: (id: string, data: UpdateJudgeInput) =>
    requestJson<AdminJudge>({ url: API.admin.judge(id), method: 'PUT', data }),
  resetJudgePassword: (id: string, data: ResetJudgePasswordInput) =>
    requestJson<{ id: string }>({ url: API.admin.judgeResetPassword(id), method: 'POST', data }),
  deactivateJudge: (id: string) =>
    requestJson<DeactivatedJudge>({ url: API.admin.judge(id), method: 'DELETE' }),
  assignments: () => requestJson<Assignment[]>({ url: API.admin.assignments }),
  replaceAssignments: (assignments: AssignmentInput[]) =>
    requestJson<Assignment[]>({ url: API.admin.assignments, method: 'PUT', data: { assignments } }),
  products: (page: number) =>
    requestJson<AdminProduct[]>({
      url: API.admin.products,
      params: { page, limit: DEFAULT_PAGE_SIZE },
    }),
};
