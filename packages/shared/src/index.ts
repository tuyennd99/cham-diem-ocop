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
  name: string;
  description: string | null;
  order: number;
  isActive: boolean;
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
export interface AdminCategoryQuery {
  page?: number;
  limit?: number;
  q?: string;
  isActive?: boolean;
}
export interface CreateAdminCategoryInput {
  name: string;
  description?: string | null;
  order?: number;
  reason: string;
}
export interface UpdateAdminCategoryInput {
  name?: string;
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

export interface RegistrationSnapshotV2 extends Omit<RegistrationSnapshotV1, "version" | "category"> {
  version: 2;
  category: { id: string; name: string };
}

export type RegistrationSnapshot = RegistrationSnapshotV1 | RegistrationSnapshotV2;

export interface ProductCategory {
  id: string;
  name: string;
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

export type AdminProductCategory = ProductCategory;

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
  registrationSnapshot: RegistrationSnapshot | null;
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
  categoryId?: string;
  isActive?: boolean;
}

export interface AdminCriteriaSetRecord {
  id: string;
  categoryId: string;
  categoryName: string;
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
  provenance: "SNAPSHOT_V1" | "SNAPSHOT_V2" | "PRE_UPGRADE" | "LIVE_DRAFT";
  historicalValuesVerified: boolean;
  submittedAt: string | null;
  product: {
    id: string;
    name: string;
    categoryName: string;
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

export const reportGroupByValues = [
  "month",
  "year",
  "locality",
  "category",
] as const;
export type ReportGroupBy = (typeof reportGroupByValues)[number];

export interface AdminReportFilterQuery {
  year?: number;
  month?: number;
  localityType?: LocalityType;
  localityId?: string;
  categoryId?: string;
  registrationType?: ProductRegistrationType;
  assessmentYear?: number;
}

export interface AdminReportQuery extends AdminReportFilterQuery {
  groupBy?: ReportGroupBy;
}

export interface ReportPeriodMetadata {
  timezone: "Asia/Ho_Chi_Minh";
  year: number;
  month: number | null;
  label: string;
  from: string;
  toExclusive: string;
  asOf: string;
  generatedAt: string;
  isPartialPeriod: boolean;
  previousPeriod: {
    label: string;
    from: string;
    toExclusive: string;
    comparisonToExclusive: string;
    asOf: string;
  };
  historyAvailableFrom: string | null;
}

export interface ReportDataQuality {
  unmappedLocalityCount: number;
  missingSubmittedAtCount: number;
  missingCompletedAtCount: number;
  missingStatusHistoryCount: number;
  invalidResultCount: number;
  assignmentHistoryAvailable: boolean;
}

export interface StarBreakdown {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface PeriodComparisonDelta {
  current: number | null;
  previous: number | null;
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  comparisonNote: "OK" | "NO_PRIOR_DATA" | "INSUFFICIENT_HISTORY";
}

export interface RegistrationReportRow {
  key: string;
  label: string;
  drillDown: Partial<AdminProductQuery>;
  registeredCount: number;
  waitingCount: number;
  scoringCount: number;
  completedCount: number;
  completedValidCount: number;
  passedCount: number;
  failedCount: number;
  passRate: number | null;
  averageScore: number | null;
  starCounts: StarBreakdown;
  distinctRegistrantCount: number;
  unmappedLocalityCount: number;
  missingDataCount: number;
}

export interface RegistrationReportResponse {
  kind: "REGISTRATIONS";
  period: ReportPeriodMetadata;
  filtersApplied: AdminReportQuery;
  groupBy: ReportGroupBy;
  totals: RegistrationReportRow;
  previousTotals: RegistrationReportRow;
  comparison: {
    registeredCount: PeriodComparisonDelta;
    completedCount: PeriodComparisonDelta;
    passedCount: PeriodComparisonDelta;
    failedCount: PeriodComparisonDelta;
  };
  rows: RegistrationReportRow[];
  dataQuality: ReportDataQuality;
}

export interface ResultsReportRow {
  key: string;
  label: string;
  drillDown: Partial<AdminProductQuery>;
  completedCount: number;
  completedValidCount: number;
  passedCount: number;
  failedCount: number;
  passRate: number | null;
  averageScore: number | null;
  starCounts: StarBreakdown;
  distinctRegistrantCount: number;
  unmappedLocalityCount: number;
  invalidResultCount: number;
}

export interface ResultsReportResponse {
  kind: "RESULTS";
  period: ReportPeriodMetadata;
  filtersApplied: AdminReportQuery;
  groupBy: ReportGroupBy;
  totals: ResultsReportRow;
  previousTotals: ResultsReportRow;
  comparison: {
    completedCount: PeriodComparisonDelta;
    passedCount: PeriodComparisonDelta;
    failedCount: PeriodComparisonDelta;
    star5Count: PeriodComparisonDelta;
  };
  rows: ResultsReportRow[];
  dataQuality: ReportDataQuality;
}

export type DashboardKpiId =
  | "registeredInPeriod"
  | "completedInPeriod"
  | "passedInPeriod"
  | "failedInPeriod"
  | "passRateInPeriod"
  | "fiveStarInPeriod"
  | "openBacklogAtAsOf"
  | "underAssignedBacklogAtAsOf";

export interface DashboardKpiItem {
  id: DashboardKpiId;
  label: string;
  basisLabel: string;
  unit: "COUNT" | "PERCENT";
  value: number | null;
  previousValue: number | null;
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  availability: "AVAILABLE" | "NO_PRIOR_DATA" | "INSUFFICIENT_HISTORY";
  drillDown: Partial<AdminProductQuery>;
}

export interface AdminAnalyticsDashboardResponse {
  period: ReportPeriodMetadata;
  filtersApplied: AdminReportFilterQuery;
  dataQuality: ReportDataQuality;
  kpis: DashboardKpiItem[];
  charts: {
    monthlyTrend: Array<{
      month: number;
      label: string;
      registeredCount: number;
      completedCount: number;
      from: string;
      toExclusive: string;
    }>;
    byCategory: Array<{
      categoryId: string;
      categoryName: string;
      registeredCount: number;
      completedCount: number;
    }>;
    cohortProgress: {
      registeredCount: number;
      waitingCount: number;
      scoringCount: number;
      completedCount: number;
      missingStatusHistoryCount: number;
    };
    starDistribution: Array<{
      stars: 1 | 2 | 3 | 4 | 5;
      label: string;
      count: number;
      percentage: number | null;
    }>;
  };
  comparisonTable: DashboardKpiItem[];
  productsByStatus: Record<ProductStatus, number>;
  judges: Array<{
    judgeId: string;
    fullName: string;
    assigned: number;
    submitted: number;
    pending: number;
  }>;
  needsAttention: Array<{
    id: string;
    name: string;
    status: "SUBMITTED" | "SCORING";
    submittedAt: string | null;
    category: { id: string; name: string };
    assignedJudgeCount: number;
    submittedEvaluationCount: number;
    pendingEvaluationCount: number;
    missingCriteriaCount: number;
  }>;
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
