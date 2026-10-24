import type {
  AdminCriteriaSetDetail,
  AdminCriteriaSetQuery,
  AdminCriteriaSetRecord,
  AdminEvaluationQuery,
  AdminEvaluationRecord,
  BlankCriteriaPrintData,
  EvaluationPrintData,
  ProductResultsPrintData,
  RegistrationPrintData,
} from '@ocop/shared';
import { API } from '../constants/api';
import { requestJson } from './base-request';

export const scoringPrintApi = {
  criteriaSets: (query: AdminCriteriaSetQuery) =>
    requestJson<AdminCriteriaSetRecord[]>({ url: API.admin.criteriaSets, params: query }),
  criteriaSetDetail: (id: string) =>
    requestJson<AdminCriteriaSetDetail>({ url: API.admin.criteriaSet(id) }),
  criteriaSetPrintData: (id: string) =>
    requestJson<BlankCriteriaPrintData>({ url: API.admin.criteriaSetPrintData(id) }),
  evaluations: (query: AdminEvaluationQuery) =>
    requestJson<AdminEvaluationRecord[]>({ url: API.admin.evaluations, params: query }),
  evaluationPrintData: (id: string) =>
    requestJson<EvaluationPrintData>({ url: API.admin.evaluationPrintData(id) }),
  judgeEvaluationPrintData: (productId: string) =>
    requestJson<EvaluationPrintData>({ url: API.judge.evaluationPrintData(productId) }),
  adminRegistrationPrintData: (productId: string) =>
    requestJson<RegistrationPrintData>({ url: API.admin.productRegistrationPrintData(productId) }),
  adminResultsPrintData: (productId: string) =>
    requestJson<ProductResultsPrintData>({ url: API.admin.productResultsPrintData(productId) }),
  myRegistrationPrintData: (productId: string) =>
    requestJson<RegistrationPrintData>({ url: API.my.registrationPrintData(productId) }),
  myResultsPrintData: (productId: string) =>
    requestJson<ProductResultsPrintData>({ url: API.my.resultsPrintData(productId) }),
};
