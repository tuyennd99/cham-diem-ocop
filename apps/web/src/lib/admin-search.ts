import {
  ADMIN_CATEGORY_SORT_BY,
  ADMIN_CRITERIA_SET_SORT_BY,
  ADMIN_EVALUATION_SORT_BY,
  ADMIN_USER_SORT_BY,
  EVALUATION_STATUS,
  JUDGE_QUEUE_SORT_BY,
  LOCALITY_SORT_BY,
  ORGANIZATION_UNIT_SORT_BY,
  PRODUCT_DATE_BASIS,
  PRODUCT_REGISTRATION_TYPE,
  PRODUCT_SORT_BY,
  PRODUCT_STATUS,
  REPORT_GROUP_BY,
  SORT_DIRECTION,
  STAFF_PERMISSION,
  USER_KIND,
  type AdminCategoryQuery,
  type AdminCategorySortBy,
  type AdminCriteriaSetQuery,
  type AdminCriteriaSetSortBy,
  type AdminEvaluationQuery,
  type AdminEvaluationSortBy,
  type AdminProductQuery,
  type AdminReportFilterQuery,
  type AdminReportQuery,
  type AdminUserQuery,
  type AdminUserSortBy,
  type EvaluationRecordStatus,
  type JudgeQueueQuery,
  type JudgeQueueSortBy,
  type LocalityQuery,
  type LocalitySortBy,
  type MyProductQuery,
  type OrganizationUnitQuery,
  type OrganizationUnitSortBy,
  type ProductRegistrationType,
  type ProductStatus,
  type ReportGroupBy,
  type SortDirection,
  type StaffPermission,
} from '@ocop/shared';
import {
  ADMIN_CATALOG_TAB,
  ADMIN_PRODUCT_DETAIL_TAB,
  ADMIN_REPORT_TAB,
  ADMIN_SCORING_TAB,
  ADMIN_USERS_TAB,
  PRODUCT_WORKSPACE_MODE,
} from '../constants/consts';
import { currentVietnameseYear, isValidIsoWithOffset } from './admin-date';

export type AdminProductDetailTab =
  (typeof ADMIN_PRODUCT_DETAIL_TAB)[keyof typeof ADMIN_PRODUCT_DETAIL_TAB];

export type AdminProductSearch = AdminProductQuery & {
  tab?: AdminProductDetailTab;
  returnMode?: typeof PRODUCT_WORKSPACE_MODE.PRODUCTS | typeof PRODUCT_WORKSPACE_MODE.REGISTRATIONS;
  returnProductId?: string;
};

const PRODUCT_STATUSES: readonly ProductStatus[] = [
  PRODUCT_STATUS.DRAFT,
  PRODUCT_STATUS.SUBMITTED,
  PRODUCT_STATUS.RETURNED,
  PRODUCT_STATUS.APPROVED,
  PRODUCT_STATUS.SCORING,
  PRODUCT_STATUS.COMPLETED,
];
const REGISTRATION_TYPES: readonly ProductRegistrationType[] = [
  PRODUCT_REGISTRATION_TYPE.FIRST,
  PRODUCT_REGISTRATION_TYPE.UPGRADE,
  PRODUCT_REGISTRATION_TYPE.REASSESSMENT,
];
const DETAIL_TABS: readonly AdminProductDetailTab[] = [
  ADMIN_PRODUCT_DETAIL_TAB.INFORMATION,
  ADMIN_PRODUCT_DETAIL_TAB.REGISTRATION,
  ADMIN_PRODUCT_DETAIL_TAB.FILES,
  ADMIN_PRODUCT_DETAIL_TAB.PROGRESS,
  ADMIN_PRODUCT_DETAIL_TAB.RESULTS,
];

function parseScalarInt(
  value: unknown,
  min: number,
  max: number,
  fallback?: number,
): number | undefined {
  if (value === undefined || value === null || value === '' || typeof value === 'boolean') {
    return fallback;
  }
  if (typeof value !== 'number' && typeof value !== 'string') {
    return fallback;
  }
  const num = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isInteger(num) || num < min || num > max) {
    return fallback;
  }
  return num;
}

function parseScalarString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return undefined;
  return trimmed;
}

function parseScalarBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== 'string') return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function parseAdminProductSearch(search: Record<string, unknown>): AdminProductSearch {
  const result: AdminProductSearch = {
    page: parseScalarInt(search.page, 1, 100000, 1) ?? 1,
    limit: parseScalarInt(search.limit, 1, 100, 20) ?? 20,
  };

  const q = parseScalarString(search.q, 100);
  if (q !== undefined) result.q = q;

  const categoryId = parseScalarString(search.categoryId, 100);
  if (categoryId !== undefined) result.categoryId = categoryId;

  const registrantId = parseScalarString(search.registrantId, 100);
  if (registrantId !== undefined) result.registrantId = registrantId;

  const registrantQ = parseScalarString(search.registrantQ, 100);
  if (registrantQ !== undefined) result.registrantQ = registrantQ;

  const localityId = parseScalarString(search.localityId, 100);
  const unmappedLocality = parseScalarBoolean(search.unmappedLocality);
  if (localityId !== undefined && unmappedLocality === true) {
    throw new Error('Không thể lọc đồng thời mã địa bàn và chưa gắn địa bàn.');
  }
  if (localityId !== undefined) result.localityId = localityId;
  if (unmappedLocality !== undefined) result.unmappedLocality = unmappedLocality;

  const status = parseEnum(search.status, PRODUCT_STATUSES);
  if (status !== undefined) result.status = status;

  const registrationType = parseEnum(search.registrationType, REGISTRATION_TYPES);
  if (registrationType !== undefined) result.registrationType = registrationType;

  const assessmentYear = parseScalarInt(search.assessmentYear, 2020, 2100);
  if (assessmentYear !== undefined) result.assessmentYear = assessmentYear;

  const dateBasis = parseEnum(search.dateBasis, [
    PRODUCT_DATE_BASIS.SUBMITTED_AT,
    PRODUCT_DATE_BASIS.COMPLETED_AT,
  ] as const);
  if (dateBasis !== undefined) result.dateBasis = dateBasis;

  if (search.from !== undefined && search.from !== null && search.from !== '') {
    if (typeof search.from !== 'string' || !isValidIsoWithOffset(search.from)) {
      throw new Error('Mốc từ ngày không hợp lệ.');
    }
    result.from = search.from;
  }

  if (
    search.toExclusive !== undefined &&
    search.toExclusive !== null &&
    search.toExclusive !== ''
  ) {
    if (typeof search.toExclusive !== 'string' || !isValidIsoWithOffset(search.toExclusive)) {
      throw new Error('Mốc đến ngày không hợp lệ.');
    }
    result.toExclusive = search.toExclusive;
  }

  if (
    result.from &&
    result.toExclusive &&
    Date.parse(result.from) >= Date.parse(result.toExclusive)
  ) {
    throw new Error('Khoảng thời gian lọc không hợp lệ.');
  }

  const starRating = parseScalarInt(search.starRating, 1, 5) as 1 | 2 | 3 | 4 | 5 | undefined;
  if (starRating !== undefined) result.starRating = starRating;

  const sortBy = parseEnum(search.sortBy, [
    PRODUCT_SORT_BY.SUBMITTED_AT,
    PRODUCT_SORT_BY.NAME,
    PRODUCT_SORT_BY.FINAL_SCORE,
  ] as const);
  if (sortBy !== undefined) result.sortBy = sortBy;

  const sortDirection = parseEnum(search.sortDirection, [
    SORT_DIRECTION.ASC,
    SORT_DIRECTION.DESC,
  ] as const);
  if (sortDirection !== undefined) result.sortDirection = sortDirection;

  const tab = parseEnum(search.tab, DETAIL_TABS);
  if (tab !== undefined) result.tab = tab;

  const returnMode = parseEnum(search.returnMode, [
    PRODUCT_WORKSPACE_MODE.PRODUCTS,
    PRODUCT_WORKSPACE_MODE.REGISTRATIONS,
  ] as const);
  if (returnMode !== undefined) result.returnMode = returnMode;

  const returnProductId = parseScalarString(search.returnProductId, 100);
  if (returnProductId !== undefined) result.returnProductId = returnProductId;

  return result;
}

export function parseAdminProductPrintSearch(search: Record<string, unknown>): AdminProductSearch {
  const result = parseAdminProductSearch(search);
  if (search.page === undefined || search.page === null || search.page === '') delete result.page;
  if (search.limit === undefined || search.limit === null || search.limit === '')
    delete result.limit;
  return result;
}

export function toAdminProductApiQuery(search: AdminProductSearch): AdminProductQuery {
  const {
    tab: _tab,
    returnMode: _returnMode,
    returnProductId: _returnProductId,
    ...query
  } = search;
  return query;
}

export function toMyProductApiQuery(search: AdminProductSearch): MyProductQuery {
  const {
    tab: _tab,
    returnMode: _returnMode,
    returnProductId: _returnProductId,
    registrantId: _registrantId,
    registrantQ: _registrantQ,
    localityId: _localityId,
    unmappedLocality: _unmappedLocality,
    ...query
  } = search;
  return query;
}

export type AdminCatalogTab = (typeof ADMIN_CATALOG_TAB)[keyof typeof ADMIN_CATALOG_TAB];

export type AdminCatalogSearch = Omit<AdminCategoryQuery, 'sortBy'> &
  Pick<LocalityQuery, 'provinceName'> & {
    tab?: AdminCatalogTab;
    sortBy?: AdminCategorySortBy | LocalitySortBy;
    sortDirection?: SortDirection;
  };

const CATALOG_TABS: readonly AdminCatalogTab[] = [
  ADMIN_CATALOG_TAB.CATALOG,
  ADMIN_CATALOG_TAB.LOCALITIES,
];
const ADMIN_CATEGORY_SORT_BYS: readonly AdminCategorySortBy[] = [
  ADMIN_CATEGORY_SORT_BY.ORDER,
  ADMIN_CATEGORY_SORT_BY.NAME,
  ADMIN_CATEGORY_SORT_BY.CRITERIA_SET,
  ADMIN_CATEGORY_SORT_BY.REFERENCE_COUNT,
  ADMIN_CATEGORY_SORT_BY.IS_ACTIVE,
];
const LOCALITY_SORT_BYS: readonly LocalitySortBy[] = [
  LOCALITY_SORT_BY.CODE,
  LOCALITY_SORT_BY.EVENT_NAME,
  LOCALITY_SORT_BY.NAME,
  LOCALITY_SORT_BY.PROVINCE_NAME,
  LOCALITY_SORT_BY.EFFECTIVE_RANGE,
  LOCALITY_SORT_BY.REGISTRATION_RANGE,
  LOCALITY_SORT_BY.IS_ACTIVE,
];
const SORT_DIRECTIONS: readonly SortDirection[] = [SORT_DIRECTION.ASC, SORT_DIRECTION.DESC];

export function parseAdminCatalogSearch(search: Record<string, unknown>): AdminCatalogSearch {
  const result: AdminCatalogSearch = {
    page: parseScalarInt(search.page, 1, 100000, 1) ?? 1,
    limit: parseScalarInt(search.limit, 1, 100, 20) ?? 20,
  };

  const q = parseScalarString(search.q, 255);
  if (q !== undefined) result.q = q;

  const isActive = parseScalarBoolean(search.isActive);
  if (isActive !== undefined) result.isActive = isActive;

  const managingAgencyId = parseScalarString(search.managingAgencyId, 100);
  if (managingAgencyId !== undefined) result.managingAgencyId = managingAgencyId;

  const provinceName = parseScalarString(search.provinceName, 255);
  if (provinceName !== undefined) result.provinceName = provinceName;

  const tab = parseEnum(search.tab, CATALOG_TABS);
  if (tab !== undefined) result.tab = tab;

  const sortBy =
    parseEnum(search.sortBy, ADMIN_CATEGORY_SORT_BYS) ??
    parseEnum(search.sortBy, LOCALITY_SORT_BYS);
  if (sortBy !== undefined) result.sortBy = sortBy;

  const sortDirection = parseEnum(search.sortDirection, SORT_DIRECTIONS);
  if (sortDirection !== undefined) result.sortDirection = sortDirection;

  return result;
}

export function toAdminCategoryApiQuery(search: AdminCatalogSearch): AdminCategoryQuery {
  const query: AdminCategoryQuery = {};
  if (search.q !== undefined) query.q = search.q;
  if (search.isActive !== undefined) query.isActive = search.isActive;
  if (search.managingAgencyId !== undefined) query.managingAgencyId = search.managingAgencyId;
  const sortBy = parseEnum(search.sortBy, ADMIN_CATEGORY_SORT_BYS);
  if (sortBy !== undefined) query.sortBy = sortBy;
  if (search.sortDirection !== undefined) query.sortDirection = search.sortDirection;
  return query;
}

export function parseAdminLocalitiesSearch(search: Record<string, unknown>): LocalityQuery {
  return toAdminLocalityApiQuery(parseAdminCatalogSearch(search));
}

export function toAdminLocalityApiQuery(search: AdminCatalogSearch): LocalityQuery {
  const query: LocalityQuery = {
    page: search.page ?? 1,
    limit: search.limit ?? 20,
  };
  if (search.q !== undefined) query.q = search.q;
  if (search.isActive !== undefined) query.isActive = search.isActive;
  if (search.provinceName !== undefined) query.provinceName = search.provinceName;
  const sortBy = parseEnum(search.sortBy, LOCALITY_SORT_BYS);
  if (sortBy !== undefined) query.sortBy = sortBy;
  if (search.sortDirection !== undefined) query.sortDirection = search.sortDirection;
  return query;
}

export type AdminUsersTab = (typeof ADMIN_USERS_TAB)[keyof typeof ADMIN_USERS_TAB];

export type AdminUsersSearch = Omit<AdminUserQuery, 'sortBy'> & {
  tab?: AdminUsersTab;
  managingAgencyId?: string;
  sortBy?: AdminUserSortBy | OrganizationUnitSortBy;
  sortDirection?: SortDirection;
};

const STAFF_PERMISSIONS: readonly StaffPermission[] = [
  STAFF_PERMISSION.MANAGE,
  STAFF_PERMISSION.VIEW,
  STAFF_PERMISSION.SCORE,
];
const USER_KINDS = [USER_KIND.STAFF, USER_KIND.REGISTRANT] as const;
const USERS_TABS: readonly AdminUsersTab[] = [ADMIN_USERS_TAB.USERS, ADMIN_USERS_TAB.UNITS];
const ADMIN_USER_SORT_BYS: readonly AdminUserSortBy[] = [
  ADMIN_USER_SORT_BY.CREATED_AT,
  ADMIN_USER_SORT_BY.FULL_NAME,
  ADMIN_USER_SORT_BY.EMAIL,
  ADMIN_USER_SORT_BY.UNIT,
  ADMIN_USER_SORT_BY.VERIFIED,
  ADMIN_USER_SORT_BY.IS_ACTIVE,
];
const ORGANIZATION_UNIT_SORT_BYS: readonly OrganizationUnitSortBy[] = [
  ORGANIZATION_UNIT_SORT_BY.ORDER,
  ORGANIZATION_UNIT_SORT_BY.CODE,
  ORGANIZATION_UNIT_SORT_BY.NAME,
  ORGANIZATION_UNIT_SORT_BY.MANAGING_AGENCY,
  ORGANIZATION_UNIT_SORT_BY.DESCRIPTION,
  ORGANIZATION_UNIT_SORT_BY.IS_ACTIVE,
];

export function parseAdminUsersSearch(search: Record<string, unknown>): AdminUsersSearch {
  const result: AdminUsersSearch = {
    page: parseScalarInt(search.page, 1, 100000, 1) ?? 1,
    limit: parseScalarInt(search.limit, 1, 100, 20) ?? 20,
  };

  const q = parseScalarString(search.q, 255);
  if (q !== undefined) result.q = q;

  const permission = parseEnum(search.permission, STAFF_PERMISSIONS);
  if (permission !== undefined) result.permission = permission;

  const organizationUnitId = parseScalarString(search.organizationUnitId, 100);
  if (organizationUnitId !== undefined) result.organizationUnitId = organizationUnitId;

  const managingAgencyId = parseScalarString(search.managingAgencyId, 100);
  if (managingAgencyId !== undefined) result.managingAgencyId = managingAgencyId;

  const isActive = parseScalarBoolean(search.isActive);
  if (isActive !== undefined) result.isActive = isActive;

  const verified = parseScalarBoolean(search.verified);
  if (verified !== undefined) result.verified = verified;

  const kind = parseEnum(search.kind, USER_KINDS);
  if (kind !== undefined) result.kind = kind;

  const tab = parseEnum(search.tab, USERS_TABS);
  if (tab !== undefined) result.tab = tab;

  const sortBy =
    parseEnum(search.sortBy, ADMIN_USER_SORT_BYS) ??
    parseEnum(search.sortBy, ORGANIZATION_UNIT_SORT_BYS);
  if (sortBy !== undefined) result.sortBy = sortBy;

  const sortDirection = parseEnum(search.sortDirection, SORT_DIRECTIONS);
  if (sortDirection !== undefined) result.sortDirection = sortDirection;

  return result;
}

export function toAdminUsersApiQuery(search: AdminUsersSearch): AdminUserQuery {
  const query: AdminUserQuery = {
    page: search.page ?? 1,
    limit: search.limit ?? 20,
  };
  if (search.q !== undefined) query.q = search.q;
  if (search.permission !== undefined) query.permission = search.permission;
  if (search.organizationUnitId !== undefined) query.organizationUnitId = search.organizationUnitId;
  if (search.isActive !== undefined) query.isActive = search.isActive;
  if (search.verified !== undefined) query.verified = search.verified;
  if (search.kind !== undefined) query.kind = search.kind;
  const sortBy = parseEnum(search.sortBy, ADMIN_USER_SORT_BYS);
  if (sortBy !== undefined) query.sortBy = sortBy;
  if (search.sortDirection !== undefined) query.sortDirection = search.sortDirection;
  return query;
}

export function toAdminUnitsApiQuery(search: AdminUsersSearch): OrganizationUnitQuery {
  const query: OrganizationUnitQuery = {
    page: search.page ?? 1,
    limit: search.limit ?? 20,
  };
  if (search.q !== undefined) query.q = search.q;
  if (search.isActive !== undefined) query.isActive = search.isActive;
  if (search.managingAgencyId !== undefined) query.managingAgencyId = search.managingAgencyId;
  const sortBy = parseEnum(search.sortBy, ORGANIZATION_UNIT_SORT_BYS);
  if (sortBy !== undefined) query.sortBy = sortBy;
  if (search.sortDirection !== undefined) query.sortDirection = search.sortDirection;
  return query;
}

export type AdminScoringTab = (typeof ADMIN_SCORING_TAB)[keyof typeof ADMIN_SCORING_TAB];

export type AdminScoringSearch = Omit<AdminCriteriaSetQuery, 'sortBy'> &
  Omit<AdminEvaluationQuery, 'sortBy'> & {
    tab?: AdminScoringTab;
    sortBy?: AdminCriteriaSetSortBy | AdminEvaluationSortBy;
    sortDirection?: SortDirection;
  };

const SCORING_TABS: readonly AdminScoringTab[] = [
  ADMIN_SCORING_TAB.SETS,
  ADMIN_SCORING_TAB.EVALUATIONS,
];
const EVALUATION_STATUSES: readonly EvaluationRecordStatus[] = [
  EVALUATION_STATUS.IN_PROGRESS,
  EVALUATION_STATUS.SUBMITTED,
  EVALUATION_STATUS.EXCLUDED,
];
const ADMIN_CRITERIA_SET_SORT_BYS: readonly AdminCriteriaSetSortBy[] = [
  ADMIN_CRITERIA_SET_SORT_BY.CATEGORY_NAME,
  ADMIN_CRITERIA_SET_SORT_BY.SOURCE,
  ADMIN_CRITERIA_SET_SORT_BY.CRITERION_COUNT,
  ADMIN_CRITERIA_SET_SORT_BY.MAX_SCORE,
];
const ADMIN_EVALUATION_SORT_BYS: readonly AdminEvaluationSortBy[] = [
  ADMIN_EVALUATION_SORT_BY.PRODUCT,
  ADMIN_EVALUATION_SORT_BY.JUDGE,
  ADMIN_EVALUATION_SORT_BY.SCOPE,
  ADMIN_EVALUATION_SORT_BY.STATUS,
  ADMIN_EVALUATION_SORT_BY.SUBMITTED_AT,
  ADMIN_EVALUATION_SORT_BY.TOTAL,
];

export function parseAdminScoringSearch(search: Record<string, unknown>): AdminScoringSearch {
  const result: AdminScoringSearch = {
    page: parseScalarInt(search.page, 1, 100000, 1) ?? 1,
    limit: parseScalarInt(search.limit, 1, 100, 20) ?? 20,
  };

  const q = parseScalarString(search.q, 100);
  if (q !== undefined) result.q = q;

  const categoryId = parseScalarString(search.categoryId, 100);
  if (categoryId !== undefined) result.categoryId = categoryId;

  const isActive = parseScalarBoolean(search.isActive);
  if (isActive !== undefined) result.isActive = isActive;

  const productId = parseScalarString(search.productId, 100);
  if (productId !== undefined) result.productId = productId;

  const judgeId = parseScalarString(search.judgeId, 100);
  if (judgeId !== undefined) result.judgeId = judgeId;

  const status = parseEnum(search.status, EVALUATION_STATUSES);
  if (status !== undefined) result.status = status;

  const tab = parseEnum(search.tab, SCORING_TABS);
  if (tab !== undefined) result.tab = tab;

  const sortBy =
    parseEnum(search.sortBy, ADMIN_CRITERIA_SET_SORT_BYS) ??
    parseEnum(search.sortBy, ADMIN_EVALUATION_SORT_BYS);
  if (sortBy !== undefined) result.sortBy = sortBy;

  const sortDirection = parseEnum(search.sortDirection, SORT_DIRECTIONS);
  if (sortDirection !== undefined) result.sortDirection = sortDirection;

  return result;
}

export function toAdminCriteriaSetsApiQuery(search: AdminScoringSearch): AdminCriteriaSetQuery {
  const query: AdminCriteriaSetQuery = {
    page: search.page ?? 1,
    limit: search.limit ?? 20,
  };
  if (search.q !== undefined) query.q = search.q;
  if (search.categoryId !== undefined) query.categoryId = search.categoryId;
  if (search.isActive !== undefined) query.isActive = search.isActive;
  const sortBy = parseEnum(search.sortBy, ADMIN_CRITERIA_SET_SORT_BYS);
  if (sortBy !== undefined) query.sortBy = sortBy;
  if (search.sortDirection !== undefined) query.sortDirection = search.sortDirection;
  return query;
}

export function toAdminEvaluationsApiQuery(search: AdminScoringSearch): AdminEvaluationQuery {
  const query: AdminEvaluationQuery = {
    page: search.page ?? 1,
    limit: search.limit ?? 20,
  };
  if (search.q !== undefined) query.q = search.q;
  if (search.productId !== undefined) query.productId = search.productId;
  if (search.categoryId !== undefined) query.categoryId = search.categoryId;
  if (search.judgeId !== undefined) query.judgeId = search.judgeId;
  if (search.status !== undefined) query.status = search.status;
  const sortBy = parseEnum(search.sortBy, ADMIN_EVALUATION_SORT_BYS);
  if (sortBy !== undefined) query.sortBy = sortBy;
  if (search.sortDirection !== undefined) query.sortDirection = search.sortDirection;
  return query;
}

export interface AdminAssignmentSearch {
  categoryId?: string;
  uncoveredOnly?: boolean;
}

export function parseAdminAssignmentSearch(search: Record<string, unknown>): AdminAssignmentSearch {
  const result: AdminAssignmentSearch = {};
  const categoryId = parseScalarString(search.categoryId, 100);
  if (categoryId !== undefined) result.categoryId = categoryId;
  const uncoveredOnly = parseScalarBoolean(search.uncoveredOnly);
  if (uncoveredOnly !== undefined) result.uncoveredOnly = uncoveredOnly;
  return result;
}

export function parseAdminDashboardSearch(search: Record<string, unknown>): AdminReportFilterQuery {
  const defaultYear = currentVietnameseYear();
  const result: AdminReportFilterQuery = {
    year: parseScalarInt(search.year, 2020, 2100, defaultYear) ?? defaultYear,
  };

  const month = parseScalarInt(search.month, 1, 12);
  if (month !== undefined) result.month = month;

  const localityId = parseScalarString(search.localityId, 100);
  if (localityId !== undefined) result.localityId = localityId;

  const categoryId = parseScalarString(search.categoryId, 100);
  if (categoryId !== undefined) result.categoryId = categoryId;

  const registrationType = parseEnum(search.registrationType, REGISTRATION_TYPES);
  if (registrationType !== undefined) result.registrationType = registrationType;

  const assessmentYear = parseScalarInt(search.assessmentYear, 2020, 2100);
  if (assessmentYear !== undefined) result.assessmentYear = assessmentYear;

  return result;
}

export type AdminReportTab = (typeof ADMIN_REPORT_TAB)[keyof typeof ADMIN_REPORT_TAB];

export type AdminReportsSearch = AdminReportQuery & {
  tab?: AdminReportTab;
};

const REPORT_GROUP_BYS: readonly ReportGroupBy[] = [
  REPORT_GROUP_BY.MONTH,
  REPORT_GROUP_BY.YEAR,
  REPORT_GROUP_BY.LOCALITY,
  REPORT_GROUP_BY.CATEGORY,
];
const REPORT_TABS: readonly AdminReportTab[] = [
  ADMIN_REPORT_TAB.REGISTRATIONS,
  ADMIN_REPORT_TAB.RESULTS,
];

export function parseAdminReportsSearch(search: Record<string, unknown>): AdminReportsSearch {
  const base = parseAdminDashboardSearch(search);
  const result: AdminReportsSearch = {
    ...base,
    groupBy: parseEnum(search.groupBy, REPORT_GROUP_BYS) ?? REPORT_GROUP_BY.MONTH,
  };
  const tab = parseEnum(search.tab, REPORT_TABS);
  if (tab !== undefined) result.tab = tab;
  return result;
}

export function toAdminReportApiQuery(search: AdminReportsSearch): AdminReportQuery {
  const { tab: _tab, ...query } = search;
  return query;
}

export interface PublicProductsSearch {
  page?: number;
  limit?: number;
  q?: string;
  categoryId?: string;
}

export function parsePublicProductsSearch(search: Record<string, unknown>): PublicProductsSearch {
  const result: PublicProductsSearch = {};
  if (search.page !== undefined && search.page !== null && search.page !== '') {
    result.page = parseScalarInt(search.page, 1, 100000, 1) ?? 1;
  }
  if (search.limit !== undefined && search.limit !== null && search.limit !== '') {
    result.limit = parseScalarInt(search.limit, 1, 100, 10) ?? 10;
  }
  const q = parseScalarString(search.q, 100);
  if (q !== undefined) result.q = q;
  const categoryId = parseScalarString(search.categoryId, 100);
  if (categoryId !== undefined) result.categoryId = categoryId;
  return result;
}

export function normalizePublicProductsSearch(
  search: PublicProductsSearch,
  defaultLimit = 10,
): PublicProductsSearch {
  const result: PublicProductsSearch = {};
  const page = search.page ?? 1;
  const limit = search.limit ?? defaultLimit;
  if (page > 1) result.page = page;
  if (limit !== defaultLimit) result.limit = limit;
  const q = parseScalarString(search.q, 100);
  if (q !== undefined) result.q = q;
  const categoryId = parseScalarString(search.categoryId, 100);
  if (categoryId !== undefined) result.categoryId = categoryId;
  return result;
}

const JUDGE_QUEUE_SORT_BYS: readonly JudgeQueueSortBy[] = [
  JUDGE_QUEUE_SORT_BY.UPDATED_AT,
  JUDGE_QUEUE_SORT_BY.NAME,
  JUDGE_QUEUE_SORT_BY.CATEGORY,
  JUDGE_QUEUE_SORT_BY.STATUS,
  JUDGE_QUEUE_SORT_BY.EVAL_STATUS,
  JUDGE_QUEUE_SORT_BY.TOTAL_SCORE,
  JUDGE_QUEUE_SORT_BY.ATTACHMENTS,
];

export type JudgeQueueSearch = JudgeQueueQuery;

export function parseJudgeQueueSearch(search: Record<string, unknown>): JudgeQueueSearch {
  const result: JudgeQueueSearch = {
    page: parseScalarInt(search.page, 1, 100000, 1) ?? 1,
    limit: parseScalarInt(search.limit, 1, 100, 10) ?? 10,
  };
  const q = parseScalarString(search.q, 100);
  if (q !== undefined) result.q = q;
  const categoryId = parseScalarString(search.categoryId, 100);
  if (categoryId !== undefined) result.categoryId = categoryId;
  const evaluationStatus = parseEnum(search.evaluationStatus, EVALUATION_STATUSES);
  if (evaluationStatus !== undefined) result.evaluationStatus = evaluationStatus;
  const sortBy = parseEnum(search.sortBy, JUDGE_QUEUE_SORT_BYS);
  if (sortBy !== undefined) result.sortBy = sortBy;
  const sortDirection = parseEnum(search.sortDirection, SORT_DIRECTIONS);
  if (sortDirection !== undefined) result.sortDirection = sortDirection;
  return result;
}

export function toJudgeQueueApiQuery(search: JudgeQueueSearch): JudgeQueueQuery {
  const query: JudgeQueueQuery = {
    page: search.page ?? 1,
    limit: search.limit ?? 10,
  };
  if (search.q !== undefined) query.q = search.q;
  if (search.categoryId !== undefined) query.categoryId = search.categoryId;
  if (search.evaluationStatus !== undefined) query.evaluationStatus = search.evaluationStatus;
  if (search.sortBy !== undefined) query.sortBy = search.sortBy;
  if (search.sortDirection !== undefined) query.sortDirection = search.sortDirection;
  return query;
}
