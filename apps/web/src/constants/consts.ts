export {
  ATTACHMENT_TYPE,
  COMPARISON_NOTE,
  DASHBOARD_KPI_ID,
  DATE_FORMAT,
  DATE_TIME_FORMAT,
  EVALUATION_STATUS,
  KPI_AVAILABILITY,
  KPI_UNIT,
  PRODUCT_DATE_BASIS,
  PRODUCT_PUBLICATION_STATE,
  PRODUCT_REGISTRATION_TYPE,
  PRODUCT_SORT_BY,
  PRODUCT_STATUS,
  REPORT_GROUP_BY,
  SORT_DIRECTION,
  STAFF_PERMISSION,
  USER_KIND,
  USER_ROLE,
} from '@ocop/shared';

export const DEFAULT_PAGE_SIZE = 10;
export const LIST_PAGE_SIZES = [10, 20, 50, 100];

export const SIZE_SM = 'sm';
export const SIZE_LG = 'lg';
export const SIZE_DEFAULT = 'default';

export const ALL = 'ALL';

export const PRODUCT_WORKSPACE_MODE = {
  OWNER: 'owner',
  ADMIN: 'admin',
  PRODUCTS: 'products',
  REGISTRATIONS: 'registrations',
  JUDGE: 'judge',
} as const;

export const ADMIN_PRODUCT_DETAIL_TAB = {
  INFORMATION: 'information',
  REGISTRATION: 'registration',
  FILES: 'files',
  PROGRESS: 'progress',
  RESULTS: 'results',
} as const;

export const ADMIN_MODAL_ACTION = {
  SUBMIT: 'submit',
  DELETE: 'delete',
  APPROVE: 'approve',
  RETURN: 'return',
  PUBLISH: 'publish',
  REOPEN: 'reopen',
} as const;

export const ADMIN_CATALOG_TAB = {
  CATALOG: 'catalog',
  LOCALITIES: 'localities',
} as const;

export const ADMIN_USERS_TAB = {
  USERS: 'users',
  UNITS: 'units',
} as const;

export const ADMIN_SCORING_TAB = {
  SETS: 'sets',
  EVALUATIONS: 'evaluations',
} as const;

export const ADMIN_REPORT_TAB = {
  REGISTRATIONS: 'registrations',
  RESULTS: 'results',
} as const;

export const ASSIGNMENT_SCOPE_MODE = {
  ALL: 'all',
  SPECIFIC: 'specific',
} as const;

export const DASHBOARD_CATEGORY_METRIC_MODE = {
  REGISTERED: 'registered',
  COMPLETED: 'completed',
} as const;

export const DRAFT_SAVE_RESULT_KIND = {
  SAVED: 'saved',
  SUBMITTED: 'submitted',
  UPLOAD_FAILED: 'upload-failed',
} as const;
