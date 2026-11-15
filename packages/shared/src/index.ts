export const USER_ROLE = {
  REGISTRANT: "REGISTRANT",
  JUDGE: "JUDGE",
  ADMIN: "ADMIN",
  VIEWER: "VIEWER",
} as const;
export type Role = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export const STAFF_PERMISSION = {
  MANAGE: "MANAGE",
  VIEW: "VIEW",
  SCORE: "SCORE",
} as const;
export type StaffPermission =
  (typeof STAFF_PERMISSION)[keyof typeof STAFF_PERMISSION];

export const USER_KIND = {
  STAFF: "STAFF",
  REGISTRANT: "REGISTRANT",
} as const;
export type UserKind = (typeof USER_KIND)[keyof typeof USER_KIND];

export interface ManagingAgencySummary {
  id: string;
  code: string;
  name: string;
  order?: number;
  isActive?: boolean;
}

export interface OrganizationUnitSummary {
  id: string;
  code: string;
  name: string;
  managingAgencyId?: string | null;
  managingAgency?: ManagingAgencySummary | null;
}

export interface OrganizationUnitRecord extends OrganizationUnitSummary {
  description: string | null;
  order: number;
  isActive: boolean;
  managingAgencyId: string | null;
  managingAgency: ManagingAgencySummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationUnitQuery {
  page?: number;
  limit?: number;
  q?: string;
  isActive?: boolean;
  managingAgencyId?: string;
}

export interface CreateOrganizationUnitInput {
  code: string;
  name: string;
  description?: string | null;
  order: number;
  isActive: boolean;
  managingAgencyId?: string | null;
  reason: string;
}

export interface UpdateOrganizationUnitInput {
  name?: string;
  description?: string | null;
  order?: number;
  isActive?: boolean;
  managingAgencyId?: string | null;
  reason: string;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  roles?: Role[];
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
  role?: Role;
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
  organizationUnitId?: string | null;
  staffPermissions?: StaffPermission[];
  roles?: Role[];
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

export interface LocalityRecord {
  id: string;
  code: string;
  eventName: string;
  name: string;
  provinceName: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  registrationFrom: string | null;
  registrationTo: string | null;
  isActive: boolean;
}

export interface LocalityQuery {
  page?: number;
  limit?: number;
  q?: string;
  provinceName?: string;
  isActive?: boolean;
}

export type PublicLocalityQuery = Omit<LocalityQuery, "isActive">;

export interface CreateLocalityInput {
  code?: string;
  eventName?: string;
  name: string;
  provinceName: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  registrationFrom?: string | null;
  registrationTo?: string | null;
  isActive: boolean;
  reason: string;
}

export interface UpdateLocalityInput {
  eventName?: string;
  name?: string;
  provinceName?: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  registrationFrom?: string | null;
  registrationTo?: string | null;
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
  managingAgencies?: ManagingAgencySummary[];
}

export interface AdminCategoryDetail extends Omit<
  AdminCategoryRecord,
  "criteriaSet"
> {
  criteriaSet:
    | (AdminCriteriaSetSummary & { criteria: CatalogCriterion[] })
    | null;
  managingAgencies?: ManagingAgencySummary[];
}

export interface AdminCategoryQuery {
  page?: number;
  limit?: number;
  q?: string;
  isActive?: boolean;
  managingAgencyId?: string;
}

export interface CreateAdminCategoryInput {
  name: string;
  description?: string | null;
  order?: number;
  managingAgencyIds?: string[];
  reason: string;
}

export interface UpdateAdminCategoryInput {
  name?: string;
  description?: string | null;
  order?: number;
  isActive?: boolean;
  managingAgencyIds?: string[];
  reason: string;
}

export const PRODUCT_CODE_PREFIX = "OCOP-";
export const PRODUCT_CODE_MIN_DIGITS = 6;

export function formatProductCode(
  codeNumber: number | null | undefined,
): string {
  if (
    typeof codeNumber !== "number" ||
    !Number.isInteger(codeNumber) ||
    codeNumber < 1
  ) {
    return "";
  }
  return `${PRODUCT_CODE_PREFIX}${String(codeNumber).padStart(PRODUCT_CODE_MIN_DIGITS, "0")}`;
}

export const PRODUCT_STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  RETURNED: "RETURNED",
  APPROVED: "APPROVED",
  SCORING: "SCORING",
  COMPLETED: "COMPLETED",
} as const;
export type ProductStatus =
  (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];

export const SEO_ELIGIBLE_PRODUCT_STATUSES = [
  PRODUCT_STATUS.APPROVED,
  PRODUCT_STATUS.SCORING,
  PRODUCT_STATUS.COMPLETED,
] as const;
export type SeoEligibleProductStatus =
  (typeof SEO_ELIGIBLE_PRODUCT_STATUSES)[number];

export function isSeoEligibleProduct(
  product:
    | {
        status?: string | null;
        approvedAt?: string | Date | null;
      }
    | null
    | undefined,
): boolean {
  if (!product) return false;
  const hasApprovedAt =
    product.approvedAt !== null &&
    product.approvedAt !== undefined &&
    String(product.approvedAt).trim().length > 0;
  return (
    hasApprovedAt &&
    (SEO_ELIGIBLE_PRODUCT_STATUSES as readonly string[]).includes(
      product.status ?? "",
    )
  );
}

export const PRODUCT_PUBLICATION_STATE = {
  UNPUBLISHED: "UNPUBLISHED",
  PUBLISHED: "PUBLISHED",
  UPDATING: "UPDATING",
} as const;
export type ProductPublicationState =
  (typeof PRODUCT_PUBLICATION_STATE)[keyof typeof PRODUCT_PUBLICATION_STATE];

export const PRODUCT_REGISTRATION_TYPE = {
  FIRST: "FIRST",
  UPGRADE: "UPGRADE",
  REASSESSMENT: "REASSESSMENT",
} as const;

export const productRegistrationTypes = [
  PRODUCT_REGISTRATION_TYPE.FIRST,
  PRODUCT_REGISTRATION_TYPE.UPGRADE,
  PRODUCT_REGISTRATION_TYPE.REASSESSMENT,
] as const;
export type ProductRegistrationType = (typeof productRegistrationTypes)[number];

export const ATTACHMENT_TYPE = {
  IMAGE: "IMAGE",
  EVIDENCE: "EVIDENCE",
} as const;
export type AttachmentType =
  (typeof ATTACHMENT_TYPE)[keyof typeof ATTACHMENT_TYPE];

export const PRODUCT_DATE_BASIS = {
  SUBMITTED_AT: "submittedAt",
  COMPLETED_AT: "completedAt",
} as const;
export type ProductDateBasis =
  (typeof PRODUCT_DATE_BASIS)[keyof typeof PRODUCT_DATE_BASIS];

export const PRODUCT_SORT_BY = {
  SUBMITTED_AT: "submittedAt",
  NAME: "name",
  FINAL_SCORE: "finalScore",
} as const;
export type ProductSortBy =
  (typeof PRODUCT_SORT_BY)[keyof typeof PRODUCT_SORT_BY];

export const SORT_DIRECTION = {
  ASC: "asc",
  DESC: "desc",
} as const;
export type SortDirection =
  (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION];

export interface ProductApplicationForm {
  entityName: string;
  representativeName: string;
  representativeTitle: string;
  contactAddress: string;
  provinceName: string;
  localityName?: string;
  localityCode?: string;
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
  registrant: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  };
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
    provinceName: string;
  };
  formData: ProductApplicationForm;
}

export interface RegistrationSnapshotV2 extends Omit<
  RegistrationSnapshotV1,
  "version" | "category" | "product"
> {
  version: 2;
  product: {
    id: string;
    codeNumber?: number;
    code?: string;
    name: string;
    description: string | null;
  };
  category: { id: string; name: string };
}

export type RegistrationSnapshot =
  | RegistrationSnapshotV1
  | RegistrationSnapshotV2;

export interface ProductCategory {
  id: string;
  name: string;
  managingAgencies?: ManagingAgencySummary[];
}

export interface ProductAttachment {
  id: string;
  fileName: string;
  type?: "IMAGE" | "EVIDENCE";
  createdAt?: string;
}

export interface Product {
  id: string;
  codeNumber?: number;
  code?: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  finalScore?: number | null;
  starRating?: number | null;
  publicationState?: ProductPublicationState;
  publishedFinalScore?: number | null;
  publishedStarRating?: number | null;
  publishedAt?: string | null;
  returnReason?: string | null;
  returnedAt?: string | null;
  approvedAt?: string | null;
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

export interface ProductJudgeAssignmentRecord {
  id: string;
  productId: string;
  judgeId: string;
  managingAgencyId: string | null;
  managingAgency: ManagingAgencySummary | null;
  organizationUnitId: string | null;
  organizationUnitName: string | null;
  isManual: boolean;
  mustSubmitToComplete: boolean;
  isActive: boolean;
  assignedAt: string;
  assignedBy: { id: string; fullName: string } | null;
  removedAt: string | null;
  removedBy: { id: string; fullName: string } | null;
  removeReason: string | null;
  judge: {
    id: string;
    fullName: string;
    email: string;
    isActive: boolean;
    organizationUnit: OrganizationUnitSummary | null;
  };
  evaluation: {
    id: string;
    status: EvaluationRecordStatus;
    previousStatus: EvaluationRecordStatus | null;
    total: number | null;
    submittedAt: string | null;
    reopenedAt: string | null;
  } | null;
}

export interface ProductAgencyCoverageItem {
  agency: ManagingAgencySummary;
  activeJudgeCount: number;
  submittedCount: number;
  hasMissingJudges: boolean;
}

export interface ProductResultHistoryItem {
  id: string;
  action: string;
  finalScore: number | null;
  starRating: number | null;
  isCurrent: boolean;
  actor: { id: string; fullName: string } | null;
  reason: string | null;
  createdAt: string;
}

export interface AdminProductListItem {
  id: string;
  codeNumber?: number;
  code?: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  finalScore: number | null;
  starRating: number | null;
  publicationState?: ProductPublicationState;
  publishedFinalScore?: number | null;
  publishedStarRating?: number | null;
  publishedAt?: string | null;
  returnReason?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  localityId: string | null;
  formData: Partial<ProductApplicationForm>;
  category: AdminProductCategory;
  registrant: { id: string; fullName: string; email: string };
  locality: Pick<
    LocalityRecord,
    "id" | "code" | "name" | "provinceName"
  > | null;
  attachments: ProductAttachment[];
  assignedJudgeCount?: number;
  missingAgencyNames?: string[];
}

export interface AdminProductDetail extends Omit<
  AdminProductListItem,
  "registrant"
> {
  registrationSnapshot: RegistrationSnapshot | null;
  registrant: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  };
  createdBy: { id: string; fullName: string } | null;
  approvedBy?: { id: string; fullName: string } | null;
  returnedBy?: { id: string; fullName: string } | null;
  publishedBy?: { id: string; fullName: string } | null;
  judgeAssignments?: ProductJudgeAssignmentRecord[];
  agencyCoverage?: ProductAgencyCoverageItem[];
  missingAgencyNames?: string[];
  resultHistory?: ProductResultHistoryItem[];
  statusEvents: {
    fromStatus: ProductStatus | null;
    toStatus: ProductStatus;
    sequence: number;
    actorId: string | null;
    actor?: { id: string; fullName: string } | null;
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
  isAssignmentRemoved?: boolean;
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

export const EVALUATION_STATUS = {
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  EXCLUDED: "EXCLUDED",
} as const;
export type EvaluationRecordStatus =
  (typeof EVALUATION_STATUS)[keyof typeof EVALUATION_STATUS];

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
    codeNumber?: number;
    code?: string;
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
    codeNumber?: number;
    code?: string;
    codeFromCurrentProduct?: boolean;
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
    codeNumber?: number;
    code?: string;
    codeFromCurrentProduct?: boolean;
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
    publicationState?: ProductPublicationState;
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
    codeNumber?: number;
    code?: string;
    codeFromCurrentProduct?: boolean;
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
    provinceName: string;
  } | null;
  formData: Partial<ProductApplicationForm>;
  attachments: ProductAttachment[];
}

export const REPORT_GROUP_BY = {
  MONTH: "month",
  YEAR: "year",
  LOCALITY: "locality",
  CATEGORY: "category",
} as const;

export const reportGroupByValues = [
  REPORT_GROUP_BY.MONTH,
  REPORT_GROUP_BY.YEAR,
  REPORT_GROUP_BY.LOCALITY,
  REPORT_GROUP_BY.CATEGORY,
] as const;
export type ReportGroupBy = (typeof reportGroupByValues)[number];

export const COMPARISON_NOTE = {
  OK: "OK",
  NO_PRIOR_DATA: "NO_PRIOR_DATA",
  INSUFFICIENT_HISTORY: "INSUFFICIENT_HISTORY",
} as const;
export type ComparisonNote =
  (typeof COMPARISON_NOTE)[keyof typeof COMPARISON_NOTE];

export const KPI_AVAILABILITY = {
  AVAILABLE: "AVAILABLE",
  NO_PRIOR_DATA: "NO_PRIOR_DATA",
  INSUFFICIENT_HISTORY: "INSUFFICIENT_HISTORY",
} as const;
export type KpiAvailability =
  (typeof KPI_AVAILABILITY)[keyof typeof KPI_AVAILABILITY];

export const KPI_UNIT = {
  COUNT: "COUNT",
  PERCENT: "PERCENT",
} as const;
export type KpiUnit = (typeof KPI_UNIT)[keyof typeof KPI_UNIT];

export const DASHBOARD_KPI_ID = {
  REGISTERED_IN_PERIOD: "registeredInPeriod",
  COMPLETED_IN_PERIOD: "completedInPeriod",
  PASSED_IN_PERIOD: "passedInPeriod",
  FAILED_IN_PERIOD: "failedInPeriod",
  PASS_RATE_IN_PERIOD: "passRateInPeriod",
  FIVE_STAR_IN_PERIOD: "fiveStarInPeriod",
  OPEN_BACKLOG_AT_AS_OF: "openBacklogAtAsOf",
  UNDER_ASSIGNED_BACKLOG_AT_AS_OF: "underAssignedBacklogAtAsOf",
} as const;

export interface AdminReportFilterQuery {
  year?: number;
  month?: number;
  localityId?: string;
  categoryId?: string;
  registrationType?: ProductRegistrationType;
  assessmentYear?: number;
}

export interface AdminDashboardQuery extends AdminReportFilterQuery {
  queuePage?: number;
  queueSearch?: string;
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
  needsAttentionTotal?: number;
  needsAttention: Array<{
    id: string;
    codeNumber?: number;
    code?: string;
    name: string;
    status: "SUBMITTED" | "APPROVED" | "SCORING";
    submittedAt: string | null;
    category: { id: string; name: string };
    assignedJudgeCount: number;
    submittedEvaluationCount: number;
    pendingEvaluationCount: number;
    missingCriteriaCount: number;
    missingAgencyNames?: string[];
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

export interface RegistrationUnitRecord {
  id: string;
  entityName: string;
  representativeName: string;
  representativeTitle: string;
  contactAddress: string;
  provinceName: string;
  localityName: string;
  localityCode: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationUnitWriteInput {
  entityName: string;
  representativeName: string;
  representativeTitle: string;
  contactAddress: string;
  provinceName: string;
  localityName: string;
  localityCode?: string | null;
  phone?: string | null;
}
