export type Role = "REGISTRANT" | "JUDGE" | "ADMIN" | "VIEWER";
export type StaffPermission = "MANAGE" | "VIEW" | "SCORE";
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
export interface AdminUserRecord {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  staffPermissions: StaffPermission[];
  organizationUnitId: string | null;
  organizationUnit: OrganizationUnitSummary | null;
  verified: boolean;
  isActive: boolean;
  createdAt: string;
}
export interface AdminUserQuery {
  page?: number;
  limit?: number;
  q?: string;
  permission?: StaffPermission;
  organizationUnitId?: string;
  isActive?: boolean;
  verified?: boolean;
  kind?: "STAFF" | "REGISTRANT";
}
export interface CreateAdminUserInput {
  email: string;
  fullName: string;
  phone?: string | null;
  password: string;
  organizationUnitId: string;
  staffPermissions: StaffPermission[];
  reason: string;
}
export interface UpdateAdminUserProfileInput {
  fullName?: string;
  phone?: string | null;
  reason: string;
}
export interface UpdateAdminUserStatusInput {
  isActive: boolean;
  reason: string;
}
export interface ResetAdminUserPasswordInput {
  password: string;
  reason: string;
}
export interface ProductGroupRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  order: number;
  isActive: boolean;
}
export interface ProductGroupQuery {
  page?: number;
  limit?: number;
  q?: string;
  isActive?: boolean;
}
export interface CreateProductGroupInput {
  code: string;
  name: string;
  description?: string | null;
  order: number;
  isActive: boolean;
  reason: string;
}
export interface UpdateProductGroupInput {
  name?: string;
  description?: string | null;
  order?: number;
  isActive?: boolean;
  reason: string;
}
export type LocalityType = "COMMUNE" | "WARD";
export interface LocalityRecord {
  id: string;
  code: string;
  name: string;
  type: LocalityType;
  provinceName: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
}
export interface LocalityQuery {
  page?: number;
  limit?: number;
  q?: string;
  type?: LocalityType;
  provinceName?: string;
  isActive?: boolean;
}
export type PublicLocalityQuery = Omit<LocalityQuery, "isActive">;
export interface CreateLocalityInput {
  code: string;
  name: string;
  type: LocalityType;
  provinceName: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isActive: boolean;
  reason: string;
}
export interface UpdateLocalityInput {
  name?: string;
  type?: LocalityType;
  provinceName?: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isActive?: boolean;
  reason: string;
}
export interface AdminCriteriaSetSummary {
  id: string;
  name: string | null;
  source: string | null;
  version: string;
  sourceHash: string | null;
  isActive: boolean;
  maxScore: number;
  criterionCount: number;
}
export interface CatalogSubCriterion extends SubCriterion {
  code: string;
}
export interface CatalogCriterion extends Omit<Criterion, "subCriteria"> {
  sectionCode: string;
  sectionName: string;
  subCriteria: CatalogSubCriterion[];
}
export interface AdminCategoryRecord {
  id: string;
  groupId: string;
  groupCode: string;
  groupName: string;
  name: string;
  description: string | null;
  order: number;
  isActive: boolean;
  classificationGroup: string;
  classificationSubgroup: string | null;
  referenceCount: number;
  submittedReferenceCount: number;
  criteriaSet: AdminCriteriaSetSummary | null;
}
export interface AdminCategoryDetail extends Omit<
  AdminCategoryRecord,
  "criteriaSet"
> {
  criteriaSet:
    (AdminCriteriaSetSummary & { criteria: CatalogCriterion[] }) | null;
}
export interface AdminCategoryQuery extends ProductGroupQuery {
  groupId?: string;
}
export interface CreateAdminCategoryInput {
  groupId: string;
  name: string;
  classificationGroup: string;
  classificationSubgroup?: string | null;
  description?: string | null;
  order?: number;
  reason: string;
}
export interface UpdateAdminCategoryInput {
  groupId?: string;
  name?: string;
  classificationGroup?: string;
  classificationSubgroup?: string | null;
  description?: string | null;
  order?: number;
  isActive?: boolean;
  reason: string;
}
export type ProductStatus = "DRAFT" | "SUBMITTED" | "SCORING" | "COMPLETED";
export const productRegistrationTypes = [
  "FIRST",
  "UPGRADE",
  "REASSESSMENT",
] as const;
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

export interface RegistrationSnapshotV1 {
  version: 1;
  submittedAt: string;
  product: { id: string; name: string; description: string | null };
  registrant: { id: string; fullName: string; email: string; phone: string | null };
  category: {
    id: string;
    name: string;
    classificationGroup: string;
    classificationSubgroup: string | null;
    group: { id: string; code: string; name: string };
  };
  locality: {
    id: string;
    code: string;
    name: string;
    type: LocalityType;
    provinceName: string;
  };
  formData: ProductApplicationForm;
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
  type?: "IMAGE" | "EVIDENCE";
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

export interface AdminProductQuery {
  page?: number;
  limit?: number;
  q?: string;
  groupId?: string;
  categoryId?: string;
  registrantId?: string;
  registrantQ?: string;
  localityId?: string;
  unmappedLocality?: boolean;
  status?: ProductStatus;
  registrationType?: ProductRegistrationType;
  assessmentYear?: number;
  dateBasis?: "submittedAt" | "completedAt";
  from?: string;
  toExclusive?: string;
  starRating?: 1 | 2 | 3 | 4 | 5;
  sortBy?: "submittedAt" | "name" | "finalScore";
  sortDirection?: "asc" | "desc";
}

export interface AdminProductCategory extends ProductCategory {
  groupId: string;
  classificationGroup: string;
  classificationSubgroup: string | null;
  group: { id: string; code: string; name: string };
}

export interface AdminProductListItem {
  id: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  finalScore: number | null;
  starRating: number | null;
  createdAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  localityId: string | null;
  formData: Partial<ProductApplicationForm>;
  category: AdminProductCategory;
  registrant: { id: string; fullName: string; email: string };
  locality: Pick<LocalityRecord, "id" | "code" | "name" | "type" | "provinceName"> | null;
  attachments: ProductAttachment[];
}

export interface AdminProductDetail extends Omit<AdminProductListItem, "registrant"> {
  registrationSnapshot: RegistrationSnapshotV1 | null;
  registrant: { id: string; fullName: string; email: string; phone: string | null };
  createdBy: { id: string; fullName: string } | null;
  statusEvents: {
    fromStatus: ProductStatus | null;
    toStatus: ProductStatus;
    sequence: number;
    actorId: string | null;
    reason: string | null;
    createdAt: string;
  }[];
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

export interface AdminCriteriaSetQuery {
  page?: number;
  limit?: number;
  q?: string;
  groupId?: string;
  isActive?: boolean;
}

export interface AdminCriteriaSetRecord {
  id: string;
  categoryId: string;
  categoryName: string;
  groupId: string;
  groupCode: string;
  groupName: string;
  classificationGroup: string;
  classificationSubgroup: string | null;
  name: string | null;
  source: string | null;
  version: string;
  sourceHash: string | null;
  isActive: boolean;
  criterionCount: number;
  maxScore: number;
}

export interface AdminCriteriaSetDetail extends AdminCriteriaSetRecord {
  criteria: CatalogCriterion[];
}

export type EvaluationRecordStatus = "IN_PROGRESS" | "SUBMITTED";

export interface AdminEvaluationQuery {
  page?: number;
  limit?: number;
  q?: string;
  productId?: string;
  groupId?: string;
  categoryId?: string;
  judgeId?: string;
  status?: EvaluationRecordStatus;
}

export interface AdminEvaluationRecord {
  id: string;
  status: EvaluationRecordStatus;
  total: number | null;
  scopeMaxScore: number;
  assignedCriterionCount: number;
  totalCriterionCount: number;
  isPartialScope: boolean;
  submittedAt: string | null;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    status: ProductStatus;
    categoryId: string;
    categoryName: string;
    groupId: string;
    groupName: string;
  };
  judge: {
    id: string;
    fullName: string;
    email: string;
    organizationUnitName: string | null;
  };
}

export interface BlankCriteriaPrintData {
  kind: "BLANK_CRITERIA";
  generatedAt: string;
  criteriaSet: AdminCriteriaSetDetail;
}

export interface EvaluationPrintSubCriterionRow {
  subCriterionId: string;
  code: string;
  content: string;
  maxPoints: number;
  selectedOptionId: string | null;
  selectedLabel: string | null;
  points: number | null;
  note: string | null;
  options: ScoreOption[];
}

export interface EvaluationPrintCriterionRow {
  criterionId: string;
  code: string;
  name: string;
  sectionCode: string;
  sectionName: string;
  maxScore: number;
  inScope: boolean;
  subCriteria: EvaluationPrintSubCriterionRow[];
}

export interface EvaluationPrintData {
  kind: "EVALUATION";
  generatedAt: string;
  evaluationId: string | null;
  status: EvaluationRecordStatus;
  isDraft: boolean;
  provenance: "SNAPSHOT_V1" | "PRE_UPGRADE" | "LIVE_DRAFT";
  historicalValuesVerified: boolean;
  submittedAt: string | null;
  product: {
    id: string;
    name: string;
    categoryName: string;
    groupName: string;
    entityName: string | null;
  };
  judge: {
    id: string;
    fullName: string;
    organizationUnitName: string | null;
  };
  criteriaSet: {
    id: string;
    name: string | null;
    source: string | null;
    version: string | null;
    sourceHash: string | null;
  };
  isPartialScope: boolean;
  total: number;
  scopeMaxScore: number;
  criteria: EvaluationPrintCriterionRow[];
}

export interface ProductResultsPrintEvaluationRow {
  id: string;
  judgeId: string;
  judgeName: string;
  organizationUnitName: string | null;
  status: EvaluationRecordStatus;
  submittedAt: string | null;
  isPartialScope: boolean;
  total: number | null;
  scopeMaxScore: number;
  criterionScores: Record<string, number | null>;
}

export interface ProductResultsPrintCriterionSummary {
  criterionId: string;
  code: string;
  name: string;
  maxScore: number;
  averageScore: number | null;
}

export interface ProductResultsPrintData {
  kind: "PRODUCT_RESULTS";
  generatedAt: string;
  product: {
    id: string;
    name: string;
    status: ProductStatus;
    submittedAt: string | null;
    completedAt: string | null;
    entityName: string | null;
    localityName: string | null;
    provinceName: string | null;
    categoryName: string;
    groupName: string;
    finalScore: number | null;
    starRating: number | null;
    starLabel: string | null;
  };
  criteriaSet: {
    id: string;
    name: string | null;
    source: string | null;
    version: string;
  } | null;
  evaluations: ProductResultsPrintEvaluationRow[];
  criteriaSummary: ProductResultsPrintCriterionSummary[];
}

export interface RegistrationPrintData {
  kind: "REGISTRATION";
  generatedAt: string;
  isDraft: boolean;
  hasSubmissionSnapshot: boolean;
  product: {
    id: string;
    name: string;
    description: string | null;
    status: ProductStatus;
    submittedAt: string | null;
    createdAt: string;
  };
  registrant: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  };
  category: {
    id: string;
    name: string;
    groupName: string;
    classificationGroup: string;
    classificationSubgroup: string | null;
  };
  locality: {
    id: string;
    code: string;
    name: string;
    type: LocalityType;
    provinceName: string;
  } | null;
  formData: Partial<ProductApplicationForm>;
  attachments: ProductAttachment[];
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
