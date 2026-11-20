import type {
  AdminCategorySortBy,
  AdminCriteriaSetSortBy,
  AdminEvaluationSortBy,
  AdminUserSortBy,
  JudgeQueueSortBy,
  LocalitySortBy,
  OrganizationUnitSortBy,
  ProductDateBasis,
  ProductRegistrationType,
  ProductSortBy,
  ReportGroupBy,
  SortDirection,
} from '@ocop/shared';

export const PRODUCT_REGISTRATION_TYPE = {
  FIRST: 'FIRST',
  UPGRADE: 'UPGRADE',
  REASSESSMENT: 'REASSESSMENT',
} as const;

export const productRegistrationTypes = [
  PRODUCT_REGISTRATION_TYPE.FIRST,
  PRODUCT_REGISTRATION_TYPE.UPGRADE,
  PRODUCT_REGISTRATION_TYPE.REASSESSMENT,
] as const satisfies readonly ProductRegistrationType[];

export const PRODUCT_MUTATION_ACTOR_KIND = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
} as const;
export type ProductMutationActorKind =
  (typeof PRODUCT_MUTATION_ACTOR_KIND)[keyof typeof PRODUCT_MUTATION_ACTOR_KIND];

export const PRODUCT_DATE_BASIS = {
  SUBMITTED_AT: 'submittedAt',
  COMPLETED_AT: 'completedAt',
} as const satisfies Record<string, ProductDateBasis>;

export const productDateBasisValues = [
  PRODUCT_DATE_BASIS.SUBMITTED_AT,
  PRODUCT_DATE_BASIS.COMPLETED_AT,
] as const satisfies readonly ProductDateBasis[];

export const PRODUCT_SORT_BY = {
  SUBMITTED_AT: 'submittedAt',
  NAME: 'name',
  FINAL_SCORE: 'finalScore',
} as const satisfies Record<string, ProductSortBy>;

export const productSortByValues = [
  PRODUCT_SORT_BY.SUBMITTED_AT,
  PRODUCT_SORT_BY.NAME,
  PRODUCT_SORT_BY.FINAL_SCORE,
] as const satisfies readonly ProductSortBy[];

export const SORT_DIRECTION = {
  ASC: 'asc',
  DESC: 'desc',
} as const satisfies Record<string, SortDirection>;

export const sortDirectionValues = [
  SORT_DIRECTION.ASC,
  SORT_DIRECTION.DESC,
] as const satisfies readonly SortDirection[];

export const ADMIN_USER_SORT_BY = {
  CREATED_AT: 'createdAt',
  FULL_NAME: 'fullName',
  EMAIL: 'email',
  UNIT: 'unit',
  VERIFIED: 'verified',
  IS_ACTIVE: 'isActive',
} as const satisfies Record<string, AdminUserSortBy>;

export const adminUserSortByValues = [
  ADMIN_USER_SORT_BY.CREATED_AT,
  ADMIN_USER_SORT_BY.FULL_NAME,
  ADMIN_USER_SORT_BY.EMAIL,
  ADMIN_USER_SORT_BY.UNIT,
  ADMIN_USER_SORT_BY.VERIFIED,
  ADMIN_USER_SORT_BY.IS_ACTIVE,
] as const satisfies readonly AdminUserSortBy[];

export const ORGANIZATION_UNIT_SORT_BY = {
  ORDER: 'order',
  CODE: 'code',
  NAME: 'name',
  MANAGING_AGENCY: 'managingAgency',
  DESCRIPTION: 'description',
  IS_ACTIVE: 'isActive',
} as const satisfies Record<string, OrganizationUnitSortBy>;

export const organizationUnitSortByValues = [
  ORGANIZATION_UNIT_SORT_BY.ORDER,
  ORGANIZATION_UNIT_SORT_BY.CODE,
  ORGANIZATION_UNIT_SORT_BY.NAME,
  ORGANIZATION_UNIT_SORT_BY.MANAGING_AGENCY,
  ORGANIZATION_UNIT_SORT_BY.DESCRIPTION,
  ORGANIZATION_UNIT_SORT_BY.IS_ACTIVE,
] as const satisfies readonly OrganizationUnitSortBy[];

export const LOCALITY_SORT_BY = {
  CODE: 'code',
  EVENT_NAME: 'eventName',
  NAME: 'name',
  PROVINCE_NAME: 'provinceName',
  EFFECTIVE_RANGE: 'effectiveRange',
  REGISTRATION_RANGE: 'registrationRange',
  IS_ACTIVE: 'isActive',
} as const satisfies Record<string, LocalitySortBy>;

export const localitySortByValues = [
  LOCALITY_SORT_BY.CODE,
  LOCALITY_SORT_BY.EVENT_NAME,
  LOCALITY_SORT_BY.NAME,
  LOCALITY_SORT_BY.PROVINCE_NAME,
  LOCALITY_SORT_BY.EFFECTIVE_RANGE,
  LOCALITY_SORT_BY.REGISTRATION_RANGE,
  LOCALITY_SORT_BY.IS_ACTIVE,
] as const satisfies readonly LocalitySortBy[];

export const ADMIN_CATEGORY_SORT_BY = {
  ORDER: 'order',
  NAME: 'name',
  CRITERIA_SET: 'criteriaSet',
  REFERENCE_COUNT: 'referenceCount',
  IS_ACTIVE: 'isActive',
} as const satisfies Record<string, AdminCategorySortBy>;

export const adminCategorySortByValues = [
  ADMIN_CATEGORY_SORT_BY.ORDER,
  ADMIN_CATEGORY_SORT_BY.NAME,
  ADMIN_CATEGORY_SORT_BY.CRITERIA_SET,
  ADMIN_CATEGORY_SORT_BY.REFERENCE_COUNT,
  ADMIN_CATEGORY_SORT_BY.IS_ACTIVE,
] as const satisfies readonly AdminCategorySortBy[];

export const ADMIN_CRITERIA_SET_SORT_BY = {
  CATEGORY_NAME: 'categoryName',
  SOURCE: 'source',
  CRITERION_COUNT: 'criterionCount',
  MAX_SCORE: 'maxScore',
} as const satisfies Record<string, AdminCriteriaSetSortBy>;

export const adminCriteriaSetSortByValues = [
  ADMIN_CRITERIA_SET_SORT_BY.CATEGORY_NAME,
  ADMIN_CRITERIA_SET_SORT_BY.SOURCE,
  ADMIN_CRITERIA_SET_SORT_BY.CRITERION_COUNT,
  ADMIN_CRITERIA_SET_SORT_BY.MAX_SCORE,
] as const satisfies readonly AdminCriteriaSetSortBy[];

export const ADMIN_EVALUATION_SORT_BY = {
  PRODUCT: 'product',
  JUDGE: 'judge',
  SCOPE: 'scope',
  STATUS: 'status',
  SUBMITTED_AT: 'submittedAt',
  TOTAL: 'total',
} as const satisfies Record<string, AdminEvaluationSortBy>;

export const adminEvaluationSortByValues = [
  ADMIN_EVALUATION_SORT_BY.PRODUCT,
  ADMIN_EVALUATION_SORT_BY.JUDGE,
  ADMIN_EVALUATION_SORT_BY.SCOPE,
  ADMIN_EVALUATION_SORT_BY.STATUS,
  ADMIN_EVALUATION_SORT_BY.SUBMITTED_AT,
  ADMIN_EVALUATION_SORT_BY.TOTAL,
] as const satisfies readonly AdminEvaluationSortBy[];

export const JUDGE_QUEUE_SORT_BY = {
  UPDATED_AT: 'updatedAt',
  NAME: 'name',
  CATEGORY: 'category',
  STATUS: 'status',
  EVAL_STATUS: 'evalStatus',
  TOTAL_SCORE: 'totalScore',
  ATTACHMENTS: 'attachments',
} as const satisfies Record<string, JudgeQueueSortBy>;

export const judgeQueueSortByValues = [
  JUDGE_QUEUE_SORT_BY.UPDATED_AT,
  JUDGE_QUEUE_SORT_BY.NAME,
  JUDGE_QUEUE_SORT_BY.CATEGORY,
  JUDGE_QUEUE_SORT_BY.STATUS,
  JUDGE_QUEUE_SORT_BY.EVAL_STATUS,
  JUDGE_QUEUE_SORT_BY.TOTAL_SCORE,
  JUDGE_QUEUE_SORT_BY.ATTACHMENTS,
] as const satisfies readonly JudgeQueueSortBy[];

export const REPORT_GROUP_BY = {
  MONTH: 'month',
  YEAR: 'year',
  LOCALITY: 'locality',
  CATEGORY: 'category',
} as const satisfies Record<string, ReportGroupBy>;

export const reportGroupByValues = [
  REPORT_GROUP_BY.MONTH,
  REPORT_GROUP_BY.YEAR,
  REPORT_GROUP_BY.LOCALITY,
  REPORT_GROUP_BY.CATEGORY,
] as const satisfies readonly ReportGroupBy[];

export const COMPARISON_NOTE = {
  OK: 'OK',
  NO_PRIOR_DATA: 'NO_PRIOR_DATA',
  INSUFFICIENT_HISTORY: 'INSUFFICIENT_HISTORY',
} as const;

export const KPI_AVAILABILITY = {
  AVAILABLE: 'AVAILABLE',
  NO_PRIOR_DATA: 'NO_PRIOR_DATA',
  INSUFFICIENT_HISTORY: 'INSUFFICIENT_HISTORY',
} as const;

export const KPI_UNIT = {
  COUNT: 'COUNT',
  PERCENT: 'PERCENT',
} as const;

export const DASHBOARD_KPI_ID = {
  REGISTERED_IN_PERIOD: 'registeredInPeriod',
  COMPLETED_IN_PERIOD: 'completedInPeriod',
  PASSED_IN_PERIOD: 'passedInPeriod',
  FAILED_IN_PERIOD: 'failedInPeriod',
  PASS_RATE_IN_PERIOD: 'passRateInPeriod',
  FIVE_STAR_IN_PERIOD: 'fiveStarInPeriod',
  OPEN_BACKLOG_AT_AS_OF: 'openBacklogAtAsOf',
  UNDER_ASSIGNED_BACKLOG_AT_AS_OF: 'underAssignedBacklogAtAsOf',
} as const;

export const REPORT_KIND = {
  REGISTRATIONS: 'REGISTRATIONS',
  RESULTS: 'RESULTS',
} as const;

export const PRINT_DATA_KIND = {
  BLANK_CRITERIA: 'BLANK_CRITERIA',
  EVALUATION: 'EVALUATION',
  REGISTRATION: 'REGISTRATION',
  PRODUCT_RESULTS: 'PRODUCT_RESULTS',
} as const;

export const EVALUATION_PROVENANCE = {
  SNAPSHOT_V1: 'SNAPSHOT_V1',
  SNAPSHOT_V2: 'SNAPSHOT_V2',
  PRE_UPGRADE: 'PRE_UPGRADE',
  LIVE_DRAFT: 'LIVE_DRAFT',
} as const;

export const EVALUATION_HISTORY_ACTION = {
  SUBMITTED: 'SUBMITTED',
  EXCLUDED: 'EXCLUDED',
  RESTORED: 'RESTORED',
  REOPENED: 'REOPENED',
} as const;

export const PRODUCT_RESULT_HISTORY_ACTION = {
  RECOMPUTE: 'RECOMPUTE',
  PUBLISHED: 'PUBLISHED',
  REPUBLISHED: 'REPUBLISHED',
  PRODUCT_REOPENED: 'PRODUCT_REOPENED',
  JUDGE_ADDED: 'JUDGE_ADDED',
  JUDGE_RESTORED: 'JUDGE_RESTORED',
  JUDGE_REMOVED: 'JUDGE_REMOVED',
  EVALUATION_SUBMITTED: 'EVALUATION_SUBMITTED',
  EVALUATION_REOPENED: 'EVALUATION_REOPENED',
} as const;

export const UPLOAD_FILE_KIND = {
  IMAGE: 'IMAGE',
  PDF: 'PDF',
  VIDEO: 'VIDEO',
} as const;
export type UploadFileKind =
  (typeof UPLOAD_FILE_KIND)[keyof typeof UPLOAD_FILE_KIND];

export const MAX_FILES_PER_PRODUCT = 5;
export const MAX_VIDEOS_PER_PRODUCT = 1;
export const MAX_ATTACHMENTS_PER_PRODUCT =
  MAX_FILES_PER_PRODUCT + MAX_VIDEOS_PER_PRODUCT;
