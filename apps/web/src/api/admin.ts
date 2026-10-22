import { DEFAULT_PAGE_SIZE } from "../constants/consts";
import { API } from "../constants/api";
import type {
  AdminDashboard,
  AdminJudge,
  AdminProduct,
  Assignment,
  AssignmentInput,
  CreateJudgeInput,
  DeactivatedJudge,
  ProductResults,
  ResetJudgePasswordInput,
  UpdateJudgeInput,
} from "../types/admin";
import { requestJson } from "./base-request";

export const adminApi = {
  dashboard: () => requestJson<AdminDashboard>({ url: API.admin.dashboard }),
  judges: () => requestJson<AdminJudge[]>({ url: API.admin.judges }),
  createJudge: (data: CreateJudgeInput) => requestJson<AdminJudge>({ url: API.admin.judges, method: "POST", data }),
  updateJudge: (id: string, data: UpdateJudgeInput) => requestJson<AdminJudge>({ url: API.admin.judge(id), method: "PUT", data }),
  resetJudgePassword: (id: string, data: ResetJudgePasswordInput) => requestJson<{ id: string }>({ url: API.admin.judgeResetPassword(id), method: "POST", data }),
  deactivateJudge: (id: string) => requestJson<DeactivatedJudge>({ url: API.admin.judge(id), method: "DELETE" }),
  assignments: () => requestJson<Assignment[]>({ url: API.admin.assignments }),
  replaceAssignments: (assignments: AssignmentInput[]) => requestJson<Assignment[]>({ url: API.admin.assignments, method: "PUT", data: { assignments } }),
  products: (page: number) => requestJson<AdminProduct[]>({ url: API.admin.products, params: { page, limit: DEFAULT_PAGE_SIZE } }),
  productResults: (id: string) => requestJson<ProductResults>({ url: API.admin.productResults(id) }),
};
