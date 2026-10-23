export type Role = 'REGISTRANT' | 'JUDGE' | 'ADMIN' | 'VIEWER';
export type StaffPermission = 'MANAGE' | 'VIEW' | 'SCORE';
export interface OrganizationUnitSummary {
  id: string;
  code: string;
  name: string;
}
export interface OrganizationUnitRecord extends OrganizationUnitSummary {
  description: string | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface OrganizationUnitQuery {
  page?: number;
  limit?: number;
  q?: string;
  isActive?: boolean;
}
export interface CreateOrganizationUnitInput {
  code: string;
  name: string;
  description?: string | null;
  order: number;
  isActive: boolean;
  reason: string;
}
export interface UpdateOrganizationUnitInput {
  name?: string;
  description?: string | null;
  order?: number;
  isActive?: boolean;
  reason: string;
}
export type ProductStatus = 'DRAFT' | 'SUBMITTED' | 'SCORING' | 'COMPLETED';
export const productRegistrationTypes = ['FIRST', 'UPGRADE', 'REASSESSMENT'] as const;
export type ProductRegistrationType = (typeof productRegistrationTypes)[number];

export interface ProductApplicationForm {
  entityName: string;
  representativeName: string;
  representativeTitle: string;
  contactAddress: string;
  provinceName: string;
  phone?: string;
  email?: string;
  registrationType: ProductRegistrationType;
  sampleQuantity: number;
  assessmentYear: number;
  declarationAccepted: boolean;
}

export interface ProductCategory {
  id: string;
  name: string;
  groupCode?: string;
  groupName?: string;
  classificationGroup?: string;
  classificationSubgroup?: string | null;
}

export interface ProductAttachment {
  id: string;
  fileName: string;
  type?: 'IMAGE' | 'EVIDENCE';
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  finalScore?: number | null;
  starRating?: number | null;
  createdAt?: string;
  updatedAt?: string;
  submittedAt?: string | null;
  formData?: Record<string, unknown>;
  category: ProductCategory;
  attachments: ProductAttachment[];
}

export interface ScoreOption {
  id: string;
  label: string;
  points: number;
}

export interface SubCriterion {
  id: string;
  content: string;
  order: number;
  options: ScoreOption[];
}

export interface Criterion {
  id: string;
  code: string;
  name: string;
  maxScore: number;
  order: number;
  subCriteria: SubCriterion[];
}

export interface EvaluationScore {
  subCriterionId: string;
  optionId: string;
  note?: string | null;
}

export interface Evaluation {
  id: string | null;
  status: string;
  total: number | null;
  scores: EvaluationScore[];
}

export interface ApiSuccess<T> {
  statusCode: number;
  data: T;
  message?: string;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiError {
  statusCode: number;
  message: string;
  requestId?: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;
