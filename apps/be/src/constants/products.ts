import type {
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
export const MAX_ATTACHMENTS_PER_PRODUCT = MAX_FILES_PER_PRODUCT + MAX_VIDEOS_PER_PRODUCT;
