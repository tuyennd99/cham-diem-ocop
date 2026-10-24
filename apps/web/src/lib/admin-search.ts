import type {
  AdminCategoryQuery,
  AdminProductQuery,
  LocalityQuery,
  LocalityType,
  ProductRegistrationType,
  ProductStatus,
} from '@ocop/shared';
import { isValidIsoWithOffset } from './admin-date';

export type AdminProductDetailTab =
  | 'information'
  | 'registration'
  | 'files'
  | 'progress'
  | 'results';

export type AdminProductSearch = AdminProductQuery & {
  tab?: AdminProductDetailTab;
};

const PRODUCT_STATUSES: readonly ProductStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'SCORING',
  'COMPLETED',
];
const REGISTRATION_TYPES: readonly ProductRegistrationType[] = [
  'FIRST',
  'UPGRADE',
  'REASSESSMENT',
];
const DETAIL_TABS: readonly AdminProductDetailTab[] = [
  'information',
  'registration',
  'files',
  'progress',
  'results',
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

export function parseAdminProductSearch(
  search: Record<string, unknown>,
): AdminProductSearch {
  const result: AdminProductSearch = {
    page: parseScalarInt(search.page, 1, 100000, 1) ?? 1,
    limit: parseScalarInt(search.limit, 1, 100, 20) ?? 20,
  };

  const q = parseScalarString(search.q, 100);
  if (q !== undefined) result.q = q;

  const groupId = parseScalarString(search.groupId, 100);
  if (groupId !== undefined) result.groupId = groupId;

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

  const dateBasis = parseEnum(search.dateBasis, ['submittedAt', 'completedAt'] as const);
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

  const sortBy = parseEnum(search.sortBy, ['submittedAt', 'name', 'finalScore'] as const);
  if (sortBy !== undefined) result.sortBy = sortBy;

  const sortDirection = parseEnum(search.sortDirection, ['asc', 'desc'] as const);
  if (sortDirection !== undefined) result.sortDirection = sortDirection;

  const tab = parseEnum(search.tab, DETAIL_TABS);
  if (tab !== undefined) result.tab = tab;

  return result;
}

export function toAdminProductApiQuery(search: AdminProductSearch): AdminProductQuery {
  const { tab: _tab, ...query } = search;
  return query;
}

export type AdminCatalogTab = 'catalog' | 'groups' | 'localities';

export type AdminCatalogSearch = AdminCategoryQuery &
  Pick<LocalityQuery, 'type' | 'provinceName'> & {
    tab?: AdminCatalogTab;
  };

const CATALOG_TABS: readonly AdminCatalogTab[] = ['catalog', 'groups', 'localities'];
const LOCALITY_TYPES: readonly LocalityType[] = ['COMMUNE', 'WARD'];

export function parseAdminCatalogSearch(
  search: Record<string, unknown>,
): AdminCatalogSearch {
  const result: AdminCatalogSearch = {
    page: parseScalarInt(search.page, 1, 100000, 1) ?? 1,
    limit: parseScalarInt(search.limit, 1, 100, 20) ?? 20,
  };

  const q = parseScalarString(search.q, 255);
  if (q !== undefined) result.q = q;

  const isActive = parseScalarBoolean(search.isActive);
  if (isActive !== undefined) result.isActive = isActive;

  const groupId = parseScalarString(search.groupId, 100);
  if (groupId !== undefined) result.groupId = groupId;

  const type = parseEnum(search.type, LOCALITY_TYPES);
  if (type !== undefined) result.type = type;

  const provinceName = parseScalarString(search.provinceName, 255);
  if (provinceName !== undefined) result.provinceName = provinceName;

  const tab = parseEnum(search.tab, CATALOG_TABS);
  if (tab !== undefined) result.tab = tab;

  return result;
}

export function toAdminCategoryApiQuery(search: AdminCatalogSearch): AdminCategoryQuery {
  const query: AdminCategoryQuery = {
    page: search.page ?? 1,
    limit: search.limit ?? 20,
  };
  if (search.q !== undefined) query.q = search.q;
  if (search.isActive !== undefined) query.isActive = search.isActive;
  if (search.groupId !== undefined) query.groupId = search.groupId;
  return query;
}

export function toAdminLocalityApiQuery(search: AdminCatalogSearch): LocalityQuery {
  const query: LocalityQuery = {
    page: search.page ?? 1,
    limit: search.limit ?? 20,
  };
  if (search.q !== undefined) query.q = search.q;
  if (search.isActive !== undefined) query.isActive = search.isActive;
  if (search.type !== undefined) query.type = search.type;
  if (search.provinceName !== undefined) query.provinceName = search.provinceName;
  return query;
}
