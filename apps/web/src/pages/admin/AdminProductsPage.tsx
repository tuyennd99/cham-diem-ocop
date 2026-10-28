import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  AdminProductListItem,
  AdminProductQuery,
  LocalityRecord,
  ProductStatus,
} from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Filter, Inbox, Plus, RotateCcw, Tag } from 'lucide-react';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable, type DataTableColumnDef } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ALL } from '../../constants/consts';
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
import { useAdminCategories, useAdminCategoryDetail } from '../../queries/admin-catalogs';
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
  const variant = status === 'COMPLETED' ? 'default' : status === 'DRAFT' ? 'secondary' : 'outline';
  return <Badge variant={variant}>{ADMIN_DASHBOARD_STATUS_LABEL[status] ?? status}</Badge>;
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

  const categoriesQuery = useAdminCategories({
    page: 1,
    limit: 100,
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

  const productColumns = useMemo<DataTableColumnDef<AdminProductListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Sản phẩm / Mã hồ sơ',
        cell: ({ row }) => {
          const product = row.original;
          const image = product.attachments.find((file) => file.type === 'IMAGE');
          return (
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
                  className='product-thumb text-muted flex items-center justify-center'
                  aria-hidden='true'
                >
                  <Tag className='size-5 opacity-40' />
                </div>
              )}
              <div>
                <div className='product-title'>{product.name}</div>
                <div className='product-code'>
                  <span title={product.id}>{product.id}</span>
                </div>
                <Badge variant='secondary' className='mt-1'>
                  {product.category.name}
                </Badge>
              </div>
            </div>
          );
        },
      },
      {
        id: 'registrant',
        header: 'Chủ thể',
        cell: ({ row }) => {
          const product = row.original;
          return (
            <div>
              <div className='registrant-name'>{product.registrant.fullName}</div>
              <div className='registrant-email'>{product.registrant.email}</div>
            </div>
          );
        },
      },
      {
        id: 'locality',
        header: 'Địa bàn / Năm',
        cell: ({ row }) => {
          const product = row.original;
          const year = product.formData.assessmentYear;
          const registrationType = product.formData.registrationType;
          return (
            <div>
              <div className='text-fg font-medium'>
                {product.locality?.name ?? 'Chưa gắn địa bàn'}
                {product.locality ? ` · ${product.locality.provinceName}` : ''}
              </div>
              <div className='text-muted mt-0.5 text-xs'>
                Năm {year ?? '—'} · {formatRegistrationType(registrationType)}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => formatStatusBadge(row.original.status),
      },
      {
        id: 'result',
        header: 'Kết quả',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) => {
          const product = row.original;
          return product.status === 'COMPLETED' && product.finalScore !== null ? (
            <div>
              <div className='score-val'>{formatExactScore(product.finalScore)} điểm</div>
              <div className='text-muted mt-0.5 text-xs'>
                {formatStarRatingLabel(product.starRating)}
              </div>
            </div>
          ) : (
            <span className='text-muted text-xs'>Chưa có kết quả</span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { align: 'right' },
        cell: ({ row }) => {
          const product = row.original;
          return (
            <div className='flex items-center justify-end gap-2'>
              <Button asChild variant='secondary' size='sm'>
                <Link
                  to={mode === 'products' ? '/admin/products/$id' : '/admin/registrations/$id'}
                  params={{ id: product.id }}
                  search={appliedSearch}
                >
                  Mở hồ sơ
                </Link>
              </Button>
              {canManage && product.status === 'DRAFT' && (
                <Button asChild variant='secondary' size='sm'>
                  <Link
                    to='/admin/registrations/$id/edit'
                    params={{ id: product.id }}
                    search={appliedSearch}
                  >
                    Sửa phiếu
                  </Link>
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [appliedSearch, canManage, mode],
  );

  function handleStatusSelect(status: ProductStatus | undefined) {
    applySearch({
      ...appliedSearch,
      page: 1,
      status,
    });
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
            <Button asChild>
              <Link to='/admin/registrations/new' search={appliedSearch}>
                <Plus className='size-4' aria-hidden='true' />
                <span>{mode === 'products' ? 'Thêm phiếu đăng ký' : 'Nhập phiếu đăng ký'}</span>
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className='status-tabs' role='group' aria-label='Lọc nhanh theo trạng thái hồ sơ'>
        {statusOptions.map((option) => {
          const pressed = (appliedSearch.status ?? undefined) === option.value;
          return (
            <button
              key={option.value ?? ALL}
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

      <form className='admin-form filter-card admin-filter-panel' onSubmit={submitFilters}>
        <div className='admin-filters'>
          <FormField
            label='Tìm sản phẩm hoặc mã hồ sơ'
            htmlFor='admin-product-q'
            className='admin-filter-field'
            data-filter-width='search'
          >
            <Input
              id='admin-product-q'
              placeholder='Nhập tên sản phẩm hoặc mã hồ sơ…'
              value={draftFilters.q ?? ''}
              maxLength={100}
              onChange={(event) =>
                setDraftFilters((old) => ({ ...old, q: event.target.value || undefined }))
              }
            />
          </FormField>

          <FormField
            label='Danh mục sản phẩm'
            htmlFor='admin-product-category'
            className='admin-filter-field'
            data-filter-width='group'
          >
            <Select
              value={draftFilters.categoryId ?? ALL}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  categoryId: value === ALL ? undefined : value,
                }))
              }
            >
              <SelectTrigger id='admin-product-category'>
                <SelectValue placeholder='Tất cả danh mục' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả danh mục</SelectItem>
                {currentCategoryOptionMissing && draftFilters.categoryId && (
                  <SelectItem value={draftFilters.categoryId}>
                    {selectedCategoryDetail.data?.data.id === draftFilters.categoryId
                      ? selectedCategoryDetail.data.data.name
                      : `Mã danh mục: ${draftFilters.categoryId}`}
                  </SelectItem>
                )}
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className='admin-actions admin-filter-actions'>
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
        </div>

        <div id='admin-product-advanced' hidden={!showAdvanced} className='advanced-filter-grid'>
          <FormField label='Từ khóa chủ thể (tên hoặc email)' htmlFor='admin-product-registrant-q'>
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
          </FormField>

          <FormField label='Loại đăng ký' htmlFor='admin-product-registration-type'>
            <Select
              value={draftFilters.registrationType ?? ALL}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  registrationType: (value === ALL
                    ? undefined
                    : value) as AdminProductQuery['registrationType'],
                }))
              }
            >
              <SelectTrigger id='admin-product-registration-type'>
                <SelectValue placeholder='Tất cả loại đăng ký' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả loại đăng ký</SelectItem>
                <SelectItem value='FIRST'>Lần đầu</SelectItem>
                <SelectItem value='UPGRADE'>Nâng hạng</SelectItem>
                <SelectItem value='REASSESSMENT'>Đánh giá lại</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label='Năm đánh giá' htmlFor='admin-product-assessment-year'>
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
          </FormField>

          <FormField label='Mức sao theo điểm' htmlFor='admin-product-star-rating'>
            <Select
              value={draftFilters.starRating ? String(draftFilters.starRating) : ALL}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  starRating: (value === ALL
                    ? undefined
                    : Number(value)) as AdminProductQuery['starRating'],
                }))
              }
            >
              <SelectTrigger id='admin-product-star-rating'>
                <SelectValue placeholder='Tất cả mức sao' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả mức sao</SelectItem>
                <SelectItem value='1'>Mức điểm 1 sao</SelectItem>
                <SelectItem value='2'>Mức điểm 2 sao</SelectItem>
                <SelectItem value='3'>Mức điểm 3 sao</SelectItem>
                <SelectItem value='4'>Mức điểm 4 sao</SelectItem>
                <SelectItem value='5'>Mức điểm 5 sao / Đề nghị xem xét 5 sao</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <div className='form-group'>
            <Label htmlFor='admin-product-locality-search'>Tìm địa bàn (xã / phường)</Label>
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
            <Label htmlFor='admin-product-locality-select' className='mt-2'>
              Địa bàn hành chính
            </Label>
            <Select
              value={draftFilters.localityId ?? ALL}
              disabled={Boolean(draftFilters.unmappedLocality)}
              onValueChange={(value) => {
                const id = value === ALL ? '' : value;
                const found = localities.find((loc) => loc.id === id) ?? null;
                setSelectedLocality(found);
                setDraftFilters((old) => ({
                  ...old,
                  localityId: id || undefined,
                  unmappedLocality: id ? undefined : old.unmappedLocality,
                }));
              }}
            >
              <SelectTrigger id='admin-product-locality-select'>
                <SelectValue placeholder='Tất cả địa bàn' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả địa bàn</SelectItem>
                {currentLocalityOptionMissing && draftFilters.localityId && (
                  <SelectItem value={draftFilters.localityId}>
                    {selectedLocality?.id === draftFilters.localityId
                      ? `${selectedLocality.name} · ${selectedLocality.provinceName}`
                      : `Mã địa bàn: ${draftFilters.localityId}`}
                  </SelectItem>
                )}
                {localities.map((locality) => (
                  <SelectItem key={locality.id} value={locality.id}>
                    {locality.name} · {locality.provinceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {localityQuery.error && (
              <AlertError
                title='Không tải được danh mục địa bàn'
                errors={[errorText(localityQuery.error)]}
              />
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
              <span className='text-muted text-xs'>
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
            <div className='inline-flex items-center gap-2'>
              <Checkbox
                id='admin-product-unmapped-locality'
                checked={draftFilters.unmappedLocality ?? false}
                onCheckedChange={(checked) =>
                  setDraftFilters((old) => ({
                    ...old,
                    unmappedLocality: checked === true ? true : undefined,
                    localityId: checked === true ? undefined : old.localityId,
                  }))
                }
              />
              <Label htmlFor='admin-product-unmapped-locality' className='cursor-pointer'>
                Chỉ hồ sơ chưa gắn địa bàn
              </Label>
            </div>
          </div>

          <FormField label='Căn cứ lọc ngày' htmlFor='admin-product-date-basis'>
            <Select
              value={draftFilters.dateBasis ?? 'submittedAt'}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  dateBasis: value as 'submittedAt' | 'completedAt',
                }))
              }
            >
              <SelectTrigger id='admin-product-date-basis'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='submittedAt'>Ngày nộp</SelectItem>
                <SelectItem value='completedAt'>Ngày hoàn tất</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label={<>Từ ngày ({formatDateBasisLabel(draftFilters.dateBasis)})</>}
            htmlFor='admin-product-from'
          >
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
          </FormField>

          <FormField
            label={<>Đến ngày ({formatDateBasisLabel(draftFilters.dateBasis)})</>}
            htmlFor='admin-product-to'
          >
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
          </FormField>

          <FormField label='Sắp xếp theo' htmlFor='admin-product-sort-by'>
            <Select
              value={draftFilters.sortBy ?? 'submittedAt'}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  sortBy: value as AdminProductQuery['sortBy'],
                }))
              }
            >
              <SelectTrigger id='admin-product-sort-by'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='submittedAt'>Ngày nộp</SelectItem>
                <SelectItem value='name'>Tên sản phẩm</SelectItem>
                <SelectItem value='finalScore'>Điểm số</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label='Thứ tự sắp xếp' htmlFor='admin-product-sort-direction'>
            <Select
              value={draftFilters.sortDirection ?? 'desc'}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  sortDirection: value as AdminProductQuery['sortDirection'],
                }))
              }
            >
              <SelectTrigger id='admin-product-sort-direction'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='desc'>Giảm dần</SelectItem>
                <SelectItem value='asc'>Tăng dần</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        {filterError && <AlertError title='Bộ lọc chưa hợp lệ' errors={[filterError]} />}

        {hasActiveFilters && (
          <div className='admin-applied-filters' aria-label='Điều kiện đang áp dụng'>
            <span className='text-muted text-xs font-semibold'>Đang lọc:</span>
            {appliedChips.map((chip) => (
              <Badge key={chip.key} variant='secondary'>
                {chip.label}
              </Badge>
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
        <div className='space-y-2'>
          <AlertError
            title={
              mode === 'products'
                ? 'Không tải được danh sách sản phẩm'
                : 'Không tải được danh sách phiếu đăng ký'
            }
            errors={[error]}
          />
          <Button type='button' variant='secondary' size='sm' onClick={() => void refetch()}>
            <RotateCcw className='size-4' aria-hidden='true' />
            <span>Thử lại</span>
          </Button>
        </div>
      )}

      {loading && <PageSpin />}

      {!loading && !error && (
        <>
          {data.length > 0 ? (
            <div
              className='admin-table-region'
              role='region'
              aria-label={mode === 'products' ? 'Bảng sản phẩm OCOP' : 'Bảng phiếu đăng ký OCOP'}
              tabIndex={0}
              aria-busy={isFetching}
            >
              <p className='admin-table-scroll-hint'>
                Vuốt hoặc dùng phím mũi tên ngang để xem đầy đủ các cột.
              </p>
              <DataTable
                columns={productColumns}
                data={data}
                total={meta?.total ?? data.length}
                page={meta?.page ?? appliedSearch.page ?? 1}
                pageSize={appliedSearch.limit ?? 20}
                getRowId={(row) => row.id}
                onPageChange={(nextPage) => changePage(nextPage)}
                onPageSizeChange={(nextLimit) =>
                  applySearch({
                    ...appliedSearch,
                    page: 1,
                    limit: nextLimit,
                  })
                }
              />
            </div>
          ) : (
            <Card className='admin-table-region empty-card'>
              <Inbox className='empty-icon mx-auto' aria-hidden='true' />
              {hasActiveFilters ? (
                <>
                  <h2 className='text-fg mb-1 text-lg font-semibold'>
                    Không có kết quả phù hợp bộ lọc
                  </h2>
                  <p className='text-muted text-sm'>
                    Thử điều chỉnh từ khóa, danh mục sản phẩm, khoảng ngày hoặc xóa bộ lọc để xem
                    toàn bộ danh sách.
                  </p>
                  <div className='admin-actions mt-4 justify-center'>
                    <Button type='button' variant='secondary' onClick={resetFilters}>
                      <RotateCcw className='size-4' aria-hidden='true' />
                      <span>Xóa bộ lọc</span>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className='text-fg mb-1 text-lg font-semibold'>
                    {mode === 'products'
                      ? 'Chưa có hồ sơ sản phẩm nào'
                      : 'Chưa có phiếu đăng ký nào'}
                  </h2>
                  <p className='text-muted text-sm'>
                    {mode === 'products'
                      ? 'Khi chủ thể nộp hồ sơ hoặc quản trị viên nhập hộ phiếu đăng ký, sản phẩm sẽ hiển thị tại đây.'
                      : 'Bắt đầu bằng cách nhập phiếu đăng ký mới cho chủ thể sản xuất.'}
                  </p>
                  {canManage && (
                    <div className='admin-actions mt-4 justify-center'>
                      <Button asChild>
                        <Link to='/admin/registrations/new' search={appliedSearch}>
                          <Plus className='size-4' aria-hidden='true' />
                          <span>
                            {mode === 'products' ? 'Thêm phiếu đăng ký' : 'Nhập phiếu đăng ký'}
                          </span>
                        </Link>
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
        </>
      )}
    </section>
  );
}
