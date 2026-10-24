import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  AdminProductQuery,
  LocalityRecord,
  ProductStatus,
} from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Inbox,
  Plus,
  RotateCcw,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ADMIN_DASHBOARD_STATUS_LABEL } from '../../constants/product-status';
import {
  nextVietnameseDayIso,
  vietnameseDateInput,
  vietnameseDayRange,
  vietnameseDayStartIso,
  vietnameseInclusiveEndInput,
} from '../../lib/admin-date';
import {
  parseAdminProductSearch,
  toAdminProductApiQuery,
  type AdminProductSearch,
} from '../../lib/admin-search';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { formatExactScore, formatStarRatingLabel } from '../../lib/print-format';
import { hasStaffPermission } from '../../lib/session-contract';
import { PrivateAttachmentThumbnail } from '../../pages/registrant/AttachmentLink';
import {
  useAdminCategories,
  useAdminCategoryDetail,
  useAdminProductGroups,
} from '../../queries/admin-catalogs';
import { useAdminProductList, type AdminProductMode } from '../../queries/admin-products';
import { useLocalities } from '../../queries/common';

interface AdminProductsPageProps {
  mode?: AdminProductMode;
  search?: AdminProductSearch;
  onSearchChange?: (next: AdminProductSearch) => void;
}

const DEFAULT_SEARCH: AdminProductSearch = {
  page: 1,
  limit: 20,
};

function formatRegistrationType(type?: string) {
  if (type === 'FIRST') return 'Lần đầu';
  if (type === 'UPGRADE') return 'Nâng hạng';
  if (type === 'REASSESSMENT') return 'Đánh giá lại';
  return type ?? 'Chưa khai báo';
}

function formatDateBasisLabel(basis?: 'submittedAt' | 'completedAt') {
  return basis === 'completedAt' ? 'Ngày hoàn tất' : 'Ngày nộp';
}

function formatStatusBadge(status: ProductStatus) {
  const tone =
    status === 'DRAFT'
      ? 'draft'
      : status === 'SUBMITTED'
        ? 'submitted'
        : status === 'SCORING'
          ? 'scoring'
          : 'completed';
  return (
    <span className={`status-badge ${tone}`}>
      {ADMIN_DASHBOARD_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function deriveDateInputs(search: AdminProductSearch): {
  from: string;
  to: string;
  fromTouched: boolean;
  toTouched: boolean;
} {
  let from = '';
  let to = '';
  if (search.from) {
    try {
      from = vietnameseDateInput(search.from);
    } catch {
      from = '';
    }
  }
  if (search.toExclusive) {
    try {
      to = vietnameseInclusiveEndInput(search.toExclusive);
    } catch {
      to = '';
    }
  }
  return { from, to, fromTouched: false, toTouched: false };
}

export function AdminProductsPage({
  mode = 'products',
  search: controlledSearch,
  onSearchChange,
}: AdminProductsPageProps) {
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const [fallbackSearch, setFallbackSearch] = useState<AdminProductSearch>(DEFAULT_SEARCH);
  const appliedSearch = controlledSearch ?? fallbackSearch;

  function applySearch(next: AdminProductSearch) {
    const normalized = parseAdminProductSearch(next as Record<string, unknown>);
    if (onSearchChange) {
      onSearchChange(normalized);
    } else {
      setFallbackSearch(normalized);
    }
  }

  const [draftFilters, setDraftFilters] = useState<AdminProductSearch>(appliedSearch);
  const [dateRange, setDateRange] = useState(() => deriveDateInputs(appliedSearch));
  const [filterError, setFilterError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setDraftFilters(appliedSearch);
    setDateRange(deriveDateInputs(appliedSearch));
    setFilterError('');
  }, [appliedSearch]);

  const [localitySearch, setLocalitySearch] = useState('');
  const [localityPage, setLocalityPage] = useState(1);
  const [selectedLocality, setSelectedLocality] = useState<LocalityRecord | null>(null);

  const groupsQuery = useAdminProductGroups({ page: 1, limit: 100 });
  const categoriesQuery = useAdminCategories({
    page: 1,
    limit: 100,
    groupId: draftFilters.groupId,
  });
  const selectedCategoryDetail = useAdminCategoryDetail(
    draftFilters.categoryId ?? appliedSearch.categoryId ?? null,
  );
  const localityQuery = useLocalities({
    page: localityPage,
    limit: 20,
    q: localitySearch.trim() || undefined,
  });

  const apiQuery = toAdminProductApiQuery(appliedSearch);
  const {
    data: response,
    error: loadError,
    isPending: loading,
    isFetching,
    refetch,
  } = useAdminProductList(mode, canManage, apiQuery);

  const error = errorText(loadError);
  const data = response?.data ?? [];
  const meta = response?.meta;
  const groups = groupsQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];
  const localities = localityQuery.data?.data ?? [];
  const localityMeta = localityQuery.data?.meta;

  const statusOptions: Array<{ value: ProductStatus | undefined; label: string }> = [
    {
      value: undefined,
      label: mode === 'products' ? 'Tất cả sản phẩm' : 'Tất cả phiếu',
    },
    ...(canManage ? [{ value: 'DRAFT' as const, label: ADMIN_DASHBOARD_STATUS_LABEL.DRAFT }] : []),
    { value: 'SUBMITTED', label: ADMIN_DASHBOARD_STATUS_LABEL.SUBMITTED },
    { value: 'SCORING', label: ADMIN_DASHBOARD_STATUS_LABEL.SCORING },
    { value: 'COMPLETED', label: ADMIN_DASHBOARD_STATUS_LABEL.COMPLETED },
  ];

  function handleStatusSelect(status: ProductStatus | undefined) {
    applySearch({
      ...appliedSearch,
      page: 1,
      status,
    });
  }

  function handleGroupChange(nextGroupId: string) {
    const groupId = nextGroupId || undefined;
    const currentCategoryStillMatches =
      !groupId ||
      categories.some(
        (cat) => cat.id === draftFilters.categoryId && cat.groupId === groupId,
      );
    setDraftFilters((current) => ({
      ...current,
      groupId,
      categoryId: currentCategoryStillMatches ? current.categoryId : undefined,
    }));
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilterError('');

    if (draftFilters.localityId && draftFilters.unmappedLocality) {
      setFilterError('Chỉ chọn một điều kiện: Địa bàn cụ thể hoặc Chưa gắn địa bàn.');
      return;
    }

    let nextFrom = draftFilters.from;
    let nextToExclusive = draftFilters.toExclusive;

    try {
      if (dateRange.fromTouched || dateRange.toTouched) {
        if (dateRange.from && dateRange.to) {
          const range = vietnameseDayRange(dateRange.from, dateRange.to);
          nextFrom = dateRange.fromTouched ? range.from : (draftFilters.from ?? range.from);
          nextToExclusive = dateRange.toTouched
            ? range.toExclusive
            : (draftFilters.toExclusive ?? range.toExclusive);
        } else if (dateRange.from) {
          nextFrom = dateRange.fromTouched
            ? vietnameseDayStartIso(dateRange.from)
            : draftFilters.from;
          if (dateRange.toTouched) nextToExclusive = undefined;
        } else if (dateRange.to) {
          if (dateRange.fromTouched) nextFrom = undefined;
          nextToExclusive = dateRange.toTouched
            ? nextVietnameseDayIso(dateRange.to)
            : draftFilters.toExclusive;
        } else {
          nextFrom = undefined;
          nextToExclusive = undefined;
        }
      }

      if (nextFrom && nextToExclusive && Date.parse(nextFrom) >= Date.parse(nextToExclusive)) {
        setFilterError('Từ ngày không được lớn hơn Đến ngày.');
        return;
      }

      applySearch({
        ...draftFilters,
        page: 1,
        from: nextFrom,
        toExclusive: nextToExclusive,
      });
    } catch (cause) {
      setFilterError(cause instanceof Error ? cause.message : 'Bộ lọc ngày không hợp lệ.');
    }
  }

  function resetFilters() {
    setFilterError('');
    setLocalitySearch('');
    setLocalityPage(1);
    setSelectedLocality(null);
    applySearch({ page: 1, limit: appliedSearch.limit ?? 20 });
  }

  function changePage(nextPage: number) {
    applySearch({
      ...appliedSearch,
      page: Math.max(1, nextPage),
    });
  }

  const appliedChips: Array<{ key: string; label: string }> = [];
  if (appliedSearch.status) {
    appliedChips.push({
      key: 'status',
      label: `Trạng thái: ${ADMIN_DASHBOARD_STATUS_LABEL[appliedSearch.status]}`,
    });
  }
  if (appliedSearch.q) {
    appliedChips.push({ key: 'q', label: `Từ khóa: ${appliedSearch.q}` });
  }
  if (appliedSearch.groupId) {
    const groupLabel =
      groups.find((item) => item.id === appliedSearch.groupId)?.name ?? appliedSearch.groupId;
    appliedChips.push({ key: 'groupId', label: `Nhóm lớn: ${groupLabel}` });
  }
  if (appliedSearch.categoryId) {
    const catLabel =
      categories.find((item) => item.id === appliedSearch.categoryId)?.name ??
      (selectedCategoryDetail.data?.data.id === appliedSearch.categoryId
        ? selectedCategoryDetail.data.data.name
        : appliedSearch.categoryId);
    appliedChips.push({ key: 'categoryId', label: `Phân loại: ${catLabel}` });
  }
  if (appliedSearch.registrantQ) {
    appliedChips.push({ key: 'registrantQ', label: `Chủ thể: ${appliedSearch.registrantQ}` });
  }
  if (appliedSearch.registrationType) {
    appliedChips.push({
      key: 'registrationType',
      label: `Loại đăng ký: ${formatRegistrationType(appliedSearch.registrationType)}`,
    });
  }
  if (appliedSearch.assessmentYear) {
    appliedChips.push({
      key: 'assessmentYear',
      label: `Năm đánh giá: ${appliedSearch.assessmentYear}`,
    });
  }
  if (appliedSearch.starRating) {
    appliedChips.push({
      key: 'starRating',
      label: formatStarRatingLabel(appliedSearch.starRating),
    });
  }
  if (appliedSearch.localityId) {
    const locLabel =
      localities.find((item) => item.id === appliedSearch.localityId)?.name ??
      (selectedLocality?.id === appliedSearch.localityId
        ? selectedLocality.name
        : appliedSearch.localityId);
    appliedChips.push({ key: 'localityId', label: `Địa bàn: ${locLabel}` });
  }
  if (appliedSearch.unmappedLocality) {
    appliedChips.push({ key: 'unmappedLocality', label: 'Chưa gắn địa bàn' });
  }
  if (appliedSearch.from || appliedSearch.toExclusive) {
    const basisText = formatDateBasisLabel(appliedSearch.dateBasis);
    const boundsText = [
      appliedSearch.from ? `từ ${appliedSearch.from}` : null,
      appliedSearch.toExclusive ? `đến trước ${appliedSearch.toExclusive}` : null,
    ]
      .filter(Boolean)
      .join(' ');
    appliedChips.push({
      key: 'dateRange',
      label: `${basisText}: ${boundsText}`,
    });
  }

  const hasActiveFilters = appliedChips.length > 0;
  const currentCategoryOptionMissing =
    Boolean(draftFilters.categoryId) &&
    !categories.some((item) => item.id === draftFilters.categoryId);
  const currentGroupOptionMissing =
    Boolean(draftFilters.groupId) && !groups.some((item) => item.id === draftFilters.groupId);
  const currentLocalityOptionMissing =
    Boolean(draftFilters.localityId) &&
    !localities.some((item) => item.id === draftFilters.localityId);

  return (
    <section className='admin-page'>
      <div className='admin-page-heading'>
        <div>
          <h1>{mode === 'products' ? 'Sản phẩm OCOP' : 'Phiếu đăng ký'}</h1>
          <p className='route-intro'>
            {mode === 'products'
              ? 'Theo dõi hồ sơ, tiến độ chấm và mức sao theo điểm.'
              : 'Nhập và quản lý phiếu đăng ký cho chủ thể.'}
          </p>
        </div>
        {canManage && (
          <div className='admin-actions'>
            <Link
              className='button button-primary'
              to='/admin/registrations/new'
              search={appliedSearch}
            >
              <Plus className='size-4' aria-hidden='true' />
              <span>
                {mode === 'products' ? 'Thêm phiếu đăng ký' : 'Nhập phiếu đăng ký'}
              </span>
            </Link>
          </div>
        )}
      </div>

      <div className='status-tabs' role='group' aria-label='Lọc nhanh theo trạng thái hồ sơ'>
        {statusOptions.map((option) => {
          const pressed = (appliedSearch.status ?? undefined) === option.value;
          return (
            <button
              key={option.value ?? 'ALL'}
              type='button'
              aria-pressed={pressed}
              className={`tab-item ${pressed ? 'active' : ''}`}
              onClick={() => handleStatusSelect(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <form className='admin-form filter-card' onSubmit={submitFilters}>
        <div className='admin-filters'>
          <label htmlFor='admin-product-q'>
            Tìm sản phẩm hoặc mã hồ sơ
            <Input
              id='admin-product-q'
              placeholder='Nhập tên sản phẩm hoặc mã hồ sơ…'
              value={draftFilters.q ?? ''}
              maxLength={100}
              onChange={(event) =>
                setDraftFilters((old) => ({ ...old, q: event.target.value || undefined }))
              }
            />
          </label>

          <label htmlFor='admin-product-group'>
            Nhóm sản phẩm lớn
            <select
              id='admin-product-group'
              value={draftFilters.groupId ?? ''}
              onChange={(event) => handleGroupChange(event.target.value)}
            >
              <option value=''>Tất cả nhóm lớn</option>
              {currentGroupOptionMissing && draftFilters.groupId && (
                <option value={draftFilters.groupId}>Mã nhóm: {draftFilters.groupId}</option>
              )}
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.code} · {group.name}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor='admin-product-category'>
            Phân loại sản phẩm
            <select
              id='admin-product-category'
              value={draftFilters.categoryId ?? ''}
              onChange={(event) =>
                setDraftFilters((old) => ({
                  ...old,
                  categoryId: event.target.value || undefined,
                }))
              }
            >
              <option value=''>Tất cả phân loại</option>
              {currentCategoryOptionMissing && draftFilters.categoryId && (
                <option value={draftFilters.categoryId}>
                  {selectedCategoryDetail.data?.data.id === draftFilters.categoryId
                    ? selectedCategoryDetail.data.data.name
                    : `Mã phân loại: ${draftFilters.categoryId}`}
                </option>
              )}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className='admin-actions' style={{ marginTop: '12px' }}>
          <Button type='submit'>Áp dụng</Button>
          <Button
            type='button'
            variant='secondary'
            aria-expanded={showAdvanced}
            aria-controls='admin-product-advanced'
            onClick={() => setShowAdvanced((open) => !open)}
          >
            <Filter className='size-4' aria-hidden='true' />
            <span>Bộ lọc khác</span>
            {hasActiveFilters && (
              <span className='admin-filter-count'>{appliedChips.length}</span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button type='button' variant='secondary' onClick={resetFilters}>
              <RotateCcw className='size-4' aria-hidden='true' />
              <span>Xóa bộ lọc</span>
            </Button>
          )}
        </div>

        <div
          id='admin-product-advanced'
          hidden={!showAdvanced}
          className='advanced-filter-grid'
        >
          <label htmlFor='admin-product-registrant-q'>
            Từ khóa chủ thể (tên hoặc email)
            <Input
              id='admin-product-registrant-q'
              placeholder='Nhập tên hoặc email chủ thể…'
              value={draftFilters.registrantQ ?? ''}
              maxLength={100}
              onChange={(event) =>
                setDraftFilters((old) => ({
                  ...old,
                  registrantQ: event.target.value || undefined,
                }))
              }
            />
          </label>

          <label htmlFor='admin-product-registration-type'>
            Loại đăng ký
            <select
              id='admin-product-registration-type'
              value={draftFilters.registrationType ?? ''}
              onChange={(event) =>
                setDraftFilters((old) => ({
                  ...old,
                  registrationType: (event.target.value ||
                    undefined) as AdminProductQuery['registrationType'],
                }))
              }
            >
              <option value=''>Tất cả loại đăng ký</option>
              <option value='FIRST'>Lần đầu</option>
              <option value='UPGRADE'>Nâng hạng</option>
              <option value='REASSESSMENT'>Đánh giá lại</option>
            </select>
          </label>

          <label htmlFor='admin-product-assessment-year'>
            Năm đánh giá
            <Input
              id='admin-product-assessment-year'
              type='number'
              min={2020}
              max={2100}
              placeholder='2026'
              value={draftFilters.assessmentYear ?? ''}
              onChange={(event) =>
                setDraftFilters((old) => ({
                  ...old,
                  assessmentYear: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
            />
          </label>

          <label htmlFor='admin-product-star-rating'>
            Mức sao theo điểm
            <select
              id='admin-product-star-rating'
              value={draftFilters.starRating ?? ''}
              onChange={(event) =>
                setDraftFilters((old) => ({
                  ...old,
                  starRating: (event.target.value
                    ? Number(event.target.value)
                    : undefined) as AdminProductQuery['starRating'],
                }))
              }
            >
              <option value=''>Tất cả mức sao</option>
              <option value='1'>Mức điểm 1 sao</option>
              <option value='2'>Mức điểm 2 sao</option>
              <option value='3'>Mức điểm 3 sao</option>
              <option value='4'>Mức điểm 4 sao</option>
              <option value='5'>Mức điểm 5 sao / Đề nghị xem xét 5 sao</option>
            </select>
          </label>

          <div className='form-group'>
            <label htmlFor='admin-product-locality-search'>Tìm địa bàn (xã / phường)</label>
            <Input
              id='admin-product-locality-search'
              placeholder='Nhập tên hoặc mã xã / phường…'
              value={localitySearch}
              maxLength={100}
              onChange={(event) => {
                setLocalitySearch(event.target.value);
                setLocalityPage(1);
              }}
            />
            <label htmlFor='admin-product-locality-select' className='mt-2'>
              Địa bàn hành chính
            </label>
            <select
              id='admin-product-locality-select'
              value={draftFilters.localityId ?? ''}
              disabled={Boolean(draftFilters.unmappedLocality)}
              onChange={(event) => {
                const id = event.target.value;
                const found = localities.find((loc) => loc.id === id) ?? null;
                setSelectedLocality(found);
                setDraftFilters((old) => ({
                  ...old,
                  localityId: id || undefined,
                  unmappedLocality: id ? undefined : old.unmappedLocality,
                }));
              }}
            >
              <option value=''>Tất cả địa bàn</option>
              {currentLocalityOptionMissing && draftFilters.localityId && (
                <option value={draftFilters.localityId}>
                  {selectedLocality?.id === draftFilters.localityId
                    ? `${selectedLocality.name} · ${selectedLocality.provinceName}`
                    : `Mã địa bàn: ${draftFilters.localityId}`}
                </option>
              )}
              {localities.map((locality) => (
                <option key={locality.id} value={locality.id}>
                  {locality.name} · {locality.provinceName}
                </option>
              ))}
            </select>
            {localityQuery.error && (
              <p className='form-note' role='alert'>
                Không tải được danh mục địa bàn: {errorText(localityQuery.error)}
              </p>
            )}
            <div className='admin-actions mt-1'>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                disabled={localityPage <= 1 || localityQuery.isPending}
                onClick={() => setLocalityPage((p) => Math.max(1, p - 1))}
              >
                Trang địa bàn trước
              </Button>
              <span className='text-xs text-muted'>
                {(localityMeta?.totalPages ?? 0) > 0
                  ? `Trang ${localityMeta?.page ?? localityPage} / ${localityMeta?.totalPages ?? 1}`
                  : 'Chưa có địa bàn phù hợp'}
              </span>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                disabled={
                  localityQuery.isPending ||
                  (localityMeta?.totalPages ?? 0) === 0 ||
                  localityPage >= (localityMeta?.totalPages ?? 1)
                }
                onClick={() => setLocalityPage((p) => p + 1)}
              >
                Trang địa bàn sau
              </Button>
            </div>
            <label
              htmlFor='admin-product-unmapped-locality'
              className='inline-flex items-center gap-2 text-sm mt-1 cursor-pointer'
            >
              <input
                id='admin-product-unmapped-locality'
                type='checkbox'
                checked={draftFilters.unmappedLocality ?? false}
                onChange={(event) =>
                  setDraftFilters((old) => ({
                    ...old,
                    unmappedLocality: event.target.checked ? true : undefined,
                    localityId: event.target.checked ? undefined : old.localityId,
                  }))
                }
              />
              <span>Chỉ hồ sơ chưa gắn địa bàn</span>
            </label>
          </div>

          <label htmlFor='admin-product-date-basis'>
            Căn cứ lọc ngày
            <select
              id='admin-product-date-basis'
              value={draftFilters.dateBasis ?? 'submittedAt'}
              onChange={(event) =>
                setDraftFilters((old) => ({
                  ...old,
                  dateBasis: event.target.value as 'submittedAt' | 'completedAt',
                }))
              }
            >
              <option value='submittedAt'>Ngày nộp</option>
              <option value='completedAt'>Ngày hoàn tất</option>
            </select>
          </label>

          <label htmlFor='admin-product-from'>
            Từ ngày ({formatDateBasisLabel(draftFilters.dateBasis)})
            <Input
              id='admin-product-from'
              type='date'
              value={dateRange.from}
              onChange={(event) =>
                setDateRange((old) => ({
                  ...old,
                  from: event.target.value,
                  fromTouched: true,
                }))
              }
            />
          </label>

          <label htmlFor='admin-product-to'>
            Đến ngày ({formatDateBasisLabel(draftFilters.dateBasis)})
            <Input
              id='admin-product-to'
              type='date'
              value={dateRange.to}
              onChange={(event) =>
                setDateRange((old) => ({
                  ...old,
                  to: event.target.value,
                  toTouched: true,
                }))
              }
            />
          </label>

          <label htmlFor='admin-product-sort-by'>
            Sắp xếp theo
            <select
              id='admin-product-sort-by'
              value={draftFilters.sortBy ?? 'submittedAt'}
              onChange={(event) =>
                setDraftFilters((old) => ({
                  ...old,
                  sortBy: event.target.value as AdminProductQuery['sortBy'],
                }))
              }
            >
              <option value='submittedAt'>Ngày nộp</option>
              <option value='name'>Tên sản phẩm</option>
              <option value='finalScore'>Điểm số</option>
            </select>
          </label>

          <label htmlFor='admin-product-sort-direction'>
            Thứ tự sắp xếp
            <select
              id='admin-product-sort-direction'
              value={draftFilters.sortDirection ?? 'desc'}
              onChange={(event) =>
                setDraftFilters((old) => ({
                  ...old,
                  sortDirection: event.target.value as AdminProductQuery['sortDirection'],
                }))
              }
            >
              <option value='desc'>Giảm dần</option>
              <option value='asc'>Tăng dần</option>
            </select>
          </label>
        </div>

        {filterError && (
          <p className='form-note' role='alert'>
            {filterError}
          </p>
        )}

        {hasActiveFilters && (
          <div className='admin-applied-filters' aria-label='Điều kiện đang áp dụng'>
            <span className='text-xs font-semibold text-muted'>Đang lọc:</span>
            {appliedChips.map((chip) => (
              <span key={chip.key} className='cat-tag'>
                {chip.label}
              </span>
            ))}
          </div>
        )}
      </form>

      {isFetching && !loading && (
        <p className='form-note' role='status' aria-live='polite'>
          Đang cập nhật danh sách theo điều kiện mới…
        </p>
      )}

      {error && (
        <div className='form-alert' role='alert'>
          <AlertCircle className='size-5 shrink-0 text-red-700' aria-hidden='true' />
          <div>
            <p className='font-semibold text-red-900'>
              {mode === 'products'
                ? 'Không tải được danh sách sản phẩm'
                : 'Không tải được danh sách phiếu đăng ký'}
            </p>
            <p className='text-sm text-red-800 mt-0.5'>{error}</p>
          </div>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            className='ml-auto'
            onClick={() => void refetch()}
          >
            <RotateCcw className='size-4' aria-hidden='true' />
            <span>Thử lại</span>
          </Button>
        </div>
      )}

      {loading && (
        <div className='admin-table-region p-8 text-center text-muted' aria-busy='true'>
          <p className='text-sm font-medium'>
            {mode === 'products'
              ? 'Đang tải danh sách sản phẩm OCOP…'
              : 'Đang tải danh sách phiếu đăng ký…'}
          </p>
        </div>
      )}

      {!loading && !error && (
        <>
          {data.length > 0 ? (
            <div
              className='admin-table-region'
              role='region'
              aria-label={
                mode === 'products' ? 'Bảng sản phẩm OCOP' : 'Bảng phiếu đăng ký OCOP'
              }
              tabIndex={0}
              aria-busy={isFetching}
            >
              <p className='admin-table-scroll-hint'>
                Vuốt hoặc dùng phím mũi tên ngang để xem đầy đủ các cột.
              </p>
              <table className='admin-data-table'>
                <thead>
                  <tr>
                    <th scope='col'>Sản phẩm / Mã hồ sơ</th>
                    <th scope='col'>Chủ thể</th>
                    <th scope='col'>Địa bàn / Năm</th>
                    <th scope='col'>Trạng thái</th>
                    <th scope='col' style={{ textAlign: 'right' }}>
                      Kết quả
                    </th>
                    <th scope='col' style={{ textAlign: 'right' }}>
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((product) => {
                    const image = product.attachments.find((file) => file.type === 'IMAGE');
                    const year = product.formData.assessmentYear;
                    const registrationType = product.formData.registrationType;
                    return (
                      <tr key={product.id}>
                        <td>
                          <div className='product-cell'>
                            {image ? (
                              <PrivateAttachmentThumbnail
                                mode='admin'
                                productId={product.id}
                                attachmentId={image.id}
                                name={product.name}
                              />
                            ) : (
                              <div
                                className='product-thumb flex items-center justify-center text-muted'
                                aria-hidden='true'
                              >
                                <Tag className='size-5 opacity-40' />
                              </div>
                            )}
                            <div>
                              <div className='product-title'>{product.name}</div>
                              <div className='product-code'>
                                <span title={product.id}>{product.id}</span> ·{' '}
                                {product.category.groupName}
                              </div>
                              <span className='cat-tag'>{product.category.name}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className='registrant-name'>{product.registrant.fullName}</div>
                          <div className='registrant-email'>{product.registrant.email}</div>
                        </td>

                        <td>
                          <div className='font-medium text-fg'>
                            {product.locality?.name ?? 'Chưa gắn địa bàn'}
                            {product.locality ? ` · ${product.locality.provinceName}` : ''}
                          </div>
                          <div className='text-xs text-muted mt-0.5'>
                            Năm {year ?? '—'} · {formatRegistrationType(registrationType)}
                          </div>
                        </td>

                        <td>{formatStatusBadge(product.status)}</td>

                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {product.status === 'COMPLETED' && product.finalScore !== null ? (
                            <div>
                              <div className='score-val'>
                                {formatExactScore(product.finalScore)} điểm
                              </div>
                              <div className='text-xs text-muted mt-0.5'>
                                {formatStarRatingLabel(product.starRating)}
                              </div>
                            </div>
                          ) : (
                            <span className='text-xs text-muted'>Chưa có kết quả</span>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div className='flex items-center justify-end gap-2'>
                            <Link
                              className='button button-secondary button-sm'
                              to={
                                mode === 'products'
                                  ? '/admin/products/$id'
                                  : '/admin/registrations/$id'
                              }
                              params={{ id: product.id }}
                              search={appliedSearch}
                            >
                              Mở hồ sơ
                            </Link>
                            {canManage && product.status === 'DRAFT' && (
                              <Link
                                className='button button-secondary button-sm'
                                to='/admin/registrations/$id/edit'
                                params={{ id: product.id }}
                                search={appliedSearch}
                              >
                                Sửa phiếu
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className='table-footer'>
                <div className='page-info'>
                  Hiển thị <strong>{data.length}</strong> /{' '}
                  <strong>{meta?.total ?? data.length}</strong>{' '}
                  {mode === 'products' ? 'sản phẩm' : 'phiếu đăng ký'}
                </div>

                <div className='pagination-actions'>
                  <Button
                    type='button'
                    variant='secondary'
                    size='sm'
                    disabled={(appliedSearch.page ?? 1) <= 1}
                    onClick={() => changePage((appliedSearch.page ?? 1) - 1)}
                  >
                    <ChevronLeft className='size-4' aria-hidden='true' />
                    <span>Trước</span>
                  </Button>
                  <span className='text-xs font-semibold px-2'>
                    Trang {meta?.page ?? appliedSearch.page ?? 1} /{' '}
                    {Math.max(1, meta?.totalPages ?? 1)}
                  </span>
                  <Button
                    type='button'
                    variant='secondary'
                    size='sm'
                    disabled={(appliedSearch.page ?? 1) >= (meta?.totalPages ?? 1)}
                    onClick={() => changePage((appliedSearch.page ?? 1) + 1)}
                  >
                    <span>Sau</span>
                    <ChevronRight className='size-4' aria-hidden='true' />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className='admin-table-region empty-card'>
              <Inbox className='empty-icon mx-auto' aria-hidden='true' />
              {hasActiveFilters ? (
                <>
                  <h2 className='font-semibold text-lg text-fg mb-1'>
                    Không có kết quả phù hợp bộ lọc
                  </h2>
                  <p className='text-sm text-muted'>
                    Thử điều chỉnh từ khóa, nhóm sản phẩm, khoảng ngày hoặc xóa bộ lọc để xem toàn
                    bộ danh sách.
                  </p>
                  <div className='admin-actions justify-center mt-4'>
                    <Button type='button' variant='secondary' onClick={resetFilters}>
                      <RotateCcw className='size-4' aria-hidden='true' />
                      <span>Xóa bộ lọc</span>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className='font-semibold text-lg text-fg mb-1'>
                    {mode === 'products'
                      ? 'Chưa có hồ sơ sản phẩm nào'
                      : 'Chưa có phiếu đăng ký nào'}
                  </h2>
                  <p className='text-sm text-muted'>
                    {mode === 'products'
                      ? 'Khi chủ thể nộp hồ sơ hoặc quản trị viên nhập hộ phiếu đăng ký, sản phẩm sẽ hiển thị tại đây.'
                      : 'Bắt đầu bằng cách nhập phiếu đăng ký mới cho chủ thể sản xuất.'}
                  </p>
                  {canManage && (
                    <div className='admin-actions justify-center mt-4'>
                      <Link
                        className='button button-primary'
                        to='/admin/registrations/new'
                        search={appliedSearch}
                      >
                        <Plus className='size-4' aria-hidden='true' />
                        <span>
                          {mode === 'products' ? 'Thêm phiếu đăng ký' : 'Nhập phiếu đăng ký'}
                        </span>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
