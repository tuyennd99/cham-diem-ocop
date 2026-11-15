import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  AdminProductListItem,
  AdminProductQuery,
  LocalityRecord,
  ProductStatus,
} from '@ocop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Eye, Filter, Inbox, Pencil, Plus, RotateCcw, Send, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AlertError from '@/components/alert-error';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { ImagePreviewDialog, type ImagePreviewItem } from '@/components/image-preview-dialog';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from '@/components/ui/combobox';
import { DataTable, type DataTableColumnDef } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { myProductsApi } from '../../api';
import {
  ADMIN_MODAL_ACTION,
  ALL,
  ATTACHMENT_TYPE,
  PRODUCT_DATE_BASIS,
  PRODUCT_PUBLICATION_STATE,
  PRODUCT_REGISTRATION_TYPE,
  PRODUCT_SORT_BY,
  PRODUCT_STATUS,
  PRODUCT_WORKSPACE_MODE,
  SORT_DIRECTION,
  STAFF_PERMISSION,
} from '../../constants/consts';
import {
  ADMIN_DASHBOARD_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
  REGISTRANT_PRODUCT_STATUS_LABEL,
} from '../../constants/product-status';
import { queryKeys } from '../../constants/query-key';
import { usePaginatedList } from '../../hooks/use-paginated-list';
import { PageContainer, PageHeader } from '../../layouts';
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
import { ADMINISTRATIVE_PROVINCES } from '../../lib/administrative-divisions';
import { errorText, messageOf } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import {
  displayProductCode,
  formatExactScore,
  formatStarRatingLabel,
  matchesProductSearchKeyword,
} from '../../lib/print-format';
import { getSavedProductSubmitIssues } from '../../lib/save-product-draft';
import { hasStaffPermission } from '../../lib/session-contract';
import { PrivateAttachmentThumbnail } from '../../pages/registrant/AttachmentLink';
import { useAdminCategories, useAdminCategoryDetail } from '../../queries/admin-catalogs';
import { useAdminProductList, type AdminProductMode } from '../../queries/admin-products';
import { useCategories, useLocalities } from '../../queries/common';
import { useMyProducts } from '../../queries/registrant';
import type { RegistrantProduct } from '../../types/registrant';

export type ProductListViewMode = AdminProductMode | typeof PRODUCT_WORKSPACE_MODE.OWNER;

type ProductRowItem = AdminProductListItem | RegistrantProduct;

interface AdminProductsPageProps {
  mode?: ProductListViewMode;
  search?: AdminProductSearch;
  onSearchChange?: (next: AdminProductSearch) => void;
}

const DEFAULT_SEARCH: AdminProductSearch = {
  page: 1,
  limit: 20,
};

function formatRegistrationType(type?: unknown) {
  if (type === PRODUCT_REGISTRATION_TYPE.FIRST) return 'Lần đầu';
  if (type === PRODUCT_REGISTRATION_TYPE.UPGRADE) return 'Nâng hạng';
  if (type === PRODUCT_REGISTRATION_TYPE.REASSESSMENT) return 'Đánh giá lại';
  return typeof type === 'string' && type ? type : 'Chưa khai báo';
}

function formatDateBasisLabel(
  basis?: typeof PRODUCT_DATE_BASIS.SUBMITTED_AT | typeof PRODUCT_DATE_BASIS.COMPLETED_AT,
) {
  return basis === PRODUCT_DATE_BASIS.COMPLETED_AT ? 'Ngày hoàn tất' : 'Ngày nộp';
}

function formatStatusBadge(status: ProductStatus, isOwner: boolean) {
  const label = isOwner
    ? (REGISTRANT_PRODUCT_STATUS_LABEL[status] ?? status)
    : (ADMIN_DASHBOARD_STATUS_LABEL[status] ?? status);
  return (
    <Badge variant='outline' className={PRODUCT_STATUS_TONE[status]}>
      {label}
    </Badge>
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
  mode = PRODUCT_WORKSPACE_MODE.PRODUCTS,
  search: controlledSearch,
  onSearchChange,
}: AdminProductsPageProps) {
  const isOwner = mode === PRODUCT_WORKSPACE_MODE.OWNER;
  const adminMode: AdminProductMode =
    mode === PRODUCT_WORKSPACE_MODE.REGISTRATIONS
      ? PRODUCT_WORKSPACE_MODE.REGISTRATIONS
      : PRODUCT_WORKSPACE_MODE.PRODUCTS;
  const queryClient = useQueryClient();
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, STAFF_PERMISSION.MANAGE);
  const {
    appliedSearch,
    applySearch,
    page: requestedPage,
    pageSize,
    setPage: changePage,
    setPageSize,
    sorting,
    setSorting,
  } = usePaginatedList<AdminProductSearch>({
    search: controlledSearch,
    onSearchChange,
    parseSearch: parseAdminProductSearch,
    defaultSearch: DEFAULT_SEARCH,
    defaultSortBy: PRODUCT_SORT_BY.SUBMITTED_AT,
    defaultSortDirection: SORT_DIRECTION.DESC,
  });

  const [draftFilters, setDraftFilters] = useState<AdminProductSearch>(appliedSearch);
  const [dateRange, setDateRange] = useState(() => deriveDateInputs(appliedSearch));
  const [filterError, setFilterError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Owner-specific draft actions (submit / delete)
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    mode: typeof ADMIN_MODAL_ACTION.SUBMIT | typeof ADMIN_MODAL_ACTION.DELETE;
    product: RegistrantProduct;
  } | null>(null);
  const [previewGallery, setPreviewGallery] = useState<{
    items: ImagePreviewItem[];
    index: number;
    label: string;
  } | null>(null);

  useEffect(() => {
    setDraftFilters(appliedSearch);
    setDateRange(deriveDateInputs(appliedSearch));
    setFilterError('');
  }, [appliedSearch]);

  const [localityProvince, setLocalityProvince] = useState('');
  const [localitySearch, setLocalitySearch] = useState('');
  const [localityPage, setLocalityPage] = useState(1);
  const [selectedLocality, setSelectedLocality] = useState<LocalityRecord | null>(null);

  const adminCategoriesQuery = useAdminCategories(
    {
      page: 1,
      limit: 100,
    },
    !isOwner,
  );
  const publicCategoriesQuery = useCategories(isOwner);
  const selectedCategoryDetail = useAdminCategoryDetail(
    !isOwner ? (draftFilters.categoryId ?? appliedSearch.categoryId ?? null) : null,
  );
  const localityQuery = useLocalities(
    {
      page: localityPage,
      limit: 100,
      provinceName: localityProvince || undefined,
      q: localitySearch.trim() || undefined,
    },
    !isOwner,
  );

  const apiQuery = toAdminProductApiQuery(appliedSearch);
  const adminListQuery = useAdminProductList(adminMode, canManage, apiQuery, !isOwner);
  const ownerListQuery = useMyProducts(isOwner);

  const loadError = isOwner ? ownerListQuery.error : adminListQuery.error;
  const loading = isOwner ? ownerListQuery.isPending : adminListQuery.isPending;
  const isFetching = isOwner ? ownerListQuery.isFetching : adminListQuery.isFetching;
  const refetch = isOwner ? ownerListQuery.refetch : adminListQuery.refetch;
  const error = errorText(loadError);

  const categories = isOwner
    ? (publicCategoriesQuery.data ?? [])
    : (adminCategoriesQuery.data?.data ?? []);
  const localities = localityQuery.data?.data ?? [];
  const localityMeta = localityQuery.data?.meta;

  const ownerStatusCounts = useMemo(() => {
    const counts: Record<ProductStatus, number> & { total: number } = {
      total: 0,
      DRAFT: 0,
      SUBMITTED: 0,
      RETURNED: 0,
      APPROVED: 0,
      SCORING: 0,
      COMPLETED: 0,
    };
    if (!isOwner) return counts;
    for (const item of ownerListQuery.data ?? []) {
      counts.total += 1;
      if (item.status in counts) {
        counts[item.status] += 1;
      }
    }
    return counts;
  }, [isOwner, ownerListQuery.data]);

  const ownerFilteredResult = useMemo(() => {
    if (!isOwner) return { rows: [] as ProductRowItem[], total: 0, page: 1 };
    const source = ownerListQuery.data ?? [];
    const keyword = appliedSearch.q?.trim().toLowerCase();
    const filtered = source.filter((item) => {
      if (appliedSearch.status && item.status !== appliedSearch.status) return false;
      if (keyword && !matchesProductSearchKeyword(item, keyword)) {
        return false;
      }
      if (appliedSearch.categoryId && item.category.id !== appliedSearch.categoryId) return false;
      if (
        appliedSearch.registrationType &&
        item.formData?.registrationType !== appliedSearch.registrationType
      ) {
        return false;
      }
      if (
        appliedSearch.assessmentYear &&
        Number(item.formData?.assessmentYear) !== appliedSearch.assessmentYear
      ) {
        return false;
      }
      if (appliedSearch.starRating && item.starRating !== appliedSearch.starRating) return false;
      if (appliedSearch.from || appliedSearch.toExclusive) {
        const rawDate =
          appliedSearch.dateBasis === PRODUCT_DATE_BASIS.COMPLETED_AT
            ? item.completedAt
            : (item.submittedAt ?? item.updatedAt);
        if (!rawDate) return false;
        const ts = Date.parse(rawDate);
        if (appliedSearch.from && ts < Date.parse(appliedSearch.from)) return false;
        if (appliedSearch.toExclusive && ts >= Date.parse(appliedSearch.toExclusive)) return false;
      }
      return true;
    });

    const sortBy = appliedSearch.sortBy ?? PRODUCT_SORT_BY.SUBMITTED_AT;
    const dir =
      (appliedSearch.sortDirection ?? SORT_DIRECTION.DESC) === SORT_DIRECTION.ASC ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === PRODUCT_SORT_BY.NAME) {
        return a.name.localeCompare(b.name, 'vi') * dir;
      }
      if (sortBy === PRODUCT_SORT_BY.FINAL_SCORE) {
        const scoreA = a.finalScore ?? -1;
        const scoreB = b.finalScore ?? -1;
        return (scoreA - scoreB) * dir;
      }
      const timeA = Date.parse(a.submittedAt ?? a.updatedAt ?? '') || 0;
      const timeB = Date.parse(b.submittedAt ?? b.updatedAt ?? '') || 0;
      return (timeA - timeB) * dir;
    });

    const pageSize = appliedSearch.limit ?? 20;
    const total = sorted.length;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, appliedSearch.page ?? 1), maxPage);
    const start = (page - 1) * pageSize;
    return {
      rows: sorted.slice(start, start + pageSize),
      total,
      page,
    };
  }, [appliedSearch, isOwner, ownerListQuery.data]);

  const data: ProductRowItem[] = isOwner
    ? ownerFilteredResult.rows
    : (adminListQuery.data?.data ?? []);
  const totalCount = isOwner
    ? ownerFilteredResult.total
    : (adminListQuery.data?.meta?.total ?? data.length);
  const currentPage = isOwner
    ? ownerFilteredResult.page
    : (adminListQuery.data?.meta?.page ?? requestedPage);

  useEffect(() => {
    if (loading) return;
    const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
    if (requestedPage > maxPage) {
      changePage(maxPage);
    }
  }, [changePage, loading, pageSize, requestedPage, totalCount]);

  async function executeOwnerConfirm() {
    if (!confirmState || busy) return;
    const { mode: confirmMode, product } = confirmState;
    setBusy(true);
    setActionError('');
    try {
      if (confirmMode === ADMIN_MODAL_ACTION.DELETE) {
        await myProductsApi.remove(product.id);
        queryClient.setQueryData<RegistrantProduct[]>(queryKeys.myProducts.list, (rows = []) =>
          rows.filter((item) => item.id !== product.id),
        );
        toast.success('Đã xóa bản nháp sản phẩm.');
      } else {
        const issues = getSavedProductSubmitIssues(product);
        if (issues.length > 0) {
          setActionError(issues[0]);
          toast.error(issues[0]);
          return;
        }
        const { data: updated } = await myProductsApi.submit(product.id);
        queryClient.setQueryData<RegistrantProduct[]>(queryKeys.myProducts.list, (rows = []) =>
          rows.map((item) => (item.id === product.id ? { ...item, ...updated } : item)),
        );
        queryClient.setQueryData<RegistrantProduct>(
          queryKeys.myProducts.detail(product.id),
          (current) => (current ? { ...current, ...updated } : updated),
        );
        toast.success('Đã nộp hồ sơ tới hội đồng đánh giá.');
      }
      setConfirmState(null);
    } catch (cause) {
      const msg = messageOf(cause);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const statusOptions: Array<{ value: ProductStatus | undefined; label: string }> = isOwner
    ? [
        { value: undefined, label: 'Tất cả hồ sơ' },
        { value: PRODUCT_STATUS.DRAFT, label: REGISTRANT_PRODUCT_STATUS_LABEL.DRAFT },
        { value: PRODUCT_STATUS.SUBMITTED, label: REGISTRANT_PRODUCT_STATUS_LABEL.SUBMITTED },
        { value: PRODUCT_STATUS.RETURNED, label: REGISTRANT_PRODUCT_STATUS_LABEL.RETURNED },
        { value: PRODUCT_STATUS.APPROVED, label: REGISTRANT_PRODUCT_STATUS_LABEL.APPROVED },
        { value: PRODUCT_STATUS.SCORING, label: REGISTRANT_PRODUCT_STATUS_LABEL.SCORING },
        { value: PRODUCT_STATUS.COMPLETED, label: REGISTRANT_PRODUCT_STATUS_LABEL.COMPLETED },
      ]
    : [
        {
          value: undefined,
          label: mode === PRODUCT_WORKSPACE_MODE.PRODUCTS ? 'Tất cả sản phẩm' : 'Tất cả phiếu',
        },
        ...(canManage
          ? [{ value: PRODUCT_STATUS.DRAFT, label: ADMIN_DASHBOARD_STATUS_LABEL.DRAFT }]
          : []),
        { value: PRODUCT_STATUS.SUBMITTED, label: ADMIN_DASHBOARD_STATUS_LABEL.SUBMITTED },
        { value: PRODUCT_STATUS.RETURNED, label: ADMIN_DASHBOARD_STATUS_LABEL.RETURNED },
        { value: PRODUCT_STATUS.APPROVED, label: ADMIN_DASHBOARD_STATUS_LABEL.APPROVED },
        { value: PRODUCT_STATUS.SCORING, label: ADMIN_DASHBOARD_STATUS_LABEL.SCORING },
        { value: PRODUCT_STATUS.COMPLETED, label: ADMIN_DASHBOARD_STATUS_LABEL.COMPLETED },
      ];

  const productColumns = useMemo<DataTableColumnDef<ProductRowItem>[]>(() => {
    const columns: DataTableColumnDef<ProductRowItem>[] = [
      {
        accessorKey: 'name',
        header: 'Sản phẩm / Mã hồ sơ',
        cell: ({ row }) => {
          const product = row.original;
          const imageAttachments = product.attachments.filter(
            (file) => file.type === ATTACHMENT_TYPE.IMAGE,
          );
          const image = imageAttachments[0];
          const attachmentMode = isOwner
            ? PRODUCT_WORKSPACE_MODE.OWNER
            : PRODUCT_WORKSPACE_MODE.ADMIN;
          return (
            <div className='product-cell'>
              {image ? (
                <button
                  type='button'
                  className='product-thumb cursor-zoom-in overflow-hidden p-0'
                  aria-label={`Xem phóng to ảnh ${product.name}`}
                  onClick={() =>
                    setPreviewGallery({
                      items: imageAttachments.map((file, idx) => ({
                        kind: 'private',
                        id: file.id,
                        name:
                          'fileName' in file && typeof file.fileName === 'string' && file.fileName
                            ? file.fileName
                            : `${product.name} — Ảnh ${idx + 1}`,
                        mode: attachmentMode,
                        productId: product.id,
                      })),
                      index: 0,
                      label: `Hồ sơ: ${product.name}`,
                    })
                  }
                >
                  <PrivateAttachmentThumbnail
                    mode={attachmentMode}
                    productId={product.id}
                    attachmentId={image.id}
                    name={product.name}
                    className='size-full object-cover'
                  />
                </button>
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
                  <span title={product.id}>{displayProductCode(product)}</span>
                </div>
                <Badge variant='secondary' className='mt-1'>
                  {product.category.name}
                </Badge>
              </div>
            </div>
          );
        },
      },
    ];

    if (!isOwner) {
      columns.push({
        id: 'registrant',
        header: 'Người đăng ký',
        enableSorting: false,
        cell: ({ row }) => {
          const product = row.original as AdminProductListItem;
          return (
            <div>
              <div className='registrant-name'>{product.registrant.fullName}</div>
              <div className='registrant-email'>{product.registrant.email}</div>
            </div>
          );
        },
      });
    }

    columns.push(
      {
        id: PRODUCT_SORT_BY.SUBMITTED_AT,
        accessorFn: (row) => row.submittedAt ?? ('updatedAt' in row ? row.updatedAt : '') ?? '',
        header: isOwner ? 'Địa bàn / Cập nhật' : 'Địa bàn / Năm',
        cell: ({ row }) => {
          const product = row.original;
          const year = product.formData?.assessmentYear as string | number | undefined;
          const registrationType = product.formData?.registrationType;
          return (
            <div>
              <div className='text-fg font-medium'>
                {product.locality?.name ?? 'Chưa gắn địa bàn'}
                {product.locality ? ` · ${product.locality.provinceName}` : ''}
              </div>
              <div className='text-muted mt-0.5 text-xs'>
                Năm {year ?? '—'} · {formatRegistrationType(registrationType)}
                {isOwner && 'updatedAt' in product
                  ? ` · ${
                      product.submittedAt
                        ? `Đã nộp ${new Date(product.submittedAt).toLocaleDateString('vi-VN')}`
                        : `Cập nhật ${new Date(product.updatedAt).toLocaleDateString('vi-VN')}`
                    }`
                  : ''}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        enableSorting: false,
        meta: { align: 'center' },
        cell: ({ row }) => formatStatusBadge(row.original.status, isOwner),
      },
      {
        id: PRODUCT_SORT_BY.FINAL_SCORE,
        accessorFn: (row) => row.finalScore ?? -1,
        header: 'Kết quả',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
        cell: ({ row }) => {
          const product = row.original;
          if (isOwner) {
            if (product.publicationState === PRODUCT_PUBLICATION_STATE.UPDATING) {
              return <span className='text-muted text-xs'>Đang cập nhật kết quả</span>;
            }
            if (
              product.status === PRODUCT_STATUS.COMPLETED &&
              product.publicationState !== PRODUCT_PUBLICATION_STATE.PUBLISHED
            ) {
              return <span className='text-muted text-xs'>Chờ công bố kết quả</span>;
            }
          }
          return product.status === PRODUCT_STATUS.COMPLETED && product.finalScore !== null ? (
            <div>
              <div className='score-val'>{formatExactScore(product.finalScore)} điểm</div>
              <div className='text-muted mt-0.5 text-xs'>
                {formatStarRatingLabel(product.starRating)}
                {!isOwner && product.publicationState === PRODUCT_PUBLICATION_STATE.PUBLISHED
                  ? ' · Đã công bố'
                  : !isOwner && product.publicationState === PRODUCT_PUBLICATION_STATE.UPDATING
                    ? ' · Chờ công bố lại'
                    : !isOwner
                      ? ' · Chưa công bố'
                      : ''}
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
        enableSorting: false,
        meta: { align: 'center' },
        cell: ({ row }) => {
          const product = row.original;
          if (isOwner) {
            const ownerProduct = product as RegistrantProduct;
            return (
              <div className='flex items-center justify-center gap-1.5'>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant='secondary' size='icon-sm'>
                      <Link
                        to='/my/products/$id'
                        params={{ id: ownerProduct.id }}
                        aria-label={`Mở hồ sơ ${ownerProduct.name}`}
                      >
                        <Eye className='size-4' aria-hidden='true' />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mở hồ sơ</TooltipContent>
                </Tooltip>
                {(ownerProduct.status === PRODUCT_STATUS.DRAFT ||
                  ownerProduct.status === PRODUCT_STATUS.RETURNED) && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button asChild variant='secondary' size='icon-sm'>
                          <Link
                            to='/my/products/$id/edit'
                            params={{ id: ownerProduct.id }}
                            aria-label={
                              ownerProduct.status === PRODUCT_STATUS.RETURNED
                                ? `Chỉnh sửa hồ sơ bị trả lại ${ownerProduct.name}`
                                : `Sửa bản nháp ${ownerProduct.name}`
                            }
                          >
                            <Pencil className='size-4' aria-hidden='true' />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {ownerProduct.status === PRODUCT_STATUS.RETURNED
                          ? 'Chỉnh sửa hồ sơ'
                          : 'Sửa bản nháp'}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type='button'
                          variant='secondary'
                          size='icon-sm'
                          disabled={busy}
                          aria-label={
                            ownerProduct.status === PRODUCT_STATUS.RETURNED
                              ? `Nộp lại hồ sơ ${ownerProduct.name}`
                              : `Nộp hồ sơ ${ownerProduct.name}`
                          }
                          onClick={() =>
                            setConfirmState({
                              mode: ADMIN_MODAL_ACTION.SUBMIT,
                              product: ownerProduct,
                            })
                          }
                        >
                          <Send className='size-4' aria-hidden='true' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {ownerProduct.status === PRODUCT_STATUS.RETURNED
                          ? 'Nộp lại hồ sơ'
                          : 'Nộp hồ sơ'}
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
                {ownerProduct.status === PRODUCT_STATUS.DRAFT && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type='button'
                        variant='destructive'
                        size='icon-sm'
                        disabled={busy}
                        aria-label={`Xóa bản nháp ${ownerProduct.name}`}
                        onClick={() =>
                          setConfirmState({
                            mode: ADMIN_MODAL_ACTION.DELETE,
                            product: ownerProduct,
                          })
                        }
                      >
                        <Trash2 className='size-4' aria-hidden='true' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Xóa bản nháp</TooltipContent>
                  </Tooltip>
                )}
              </div>
            );
          }

          return (
            <div className='flex items-center justify-end gap-2'>
              <Button asChild variant='secondary' size='sm'>
                <Link
                  to={
                    mode === PRODUCT_WORKSPACE_MODE.PRODUCTS
                      ? '/admin/products/$id'
                      : '/admin/registrations/$id'
                  }
                  params={{ id: product.id }}
                  search={appliedSearch}
                >
                  Mở hồ sơ
                </Link>
              </Button>
              {canManage &&
                (product.status === PRODUCT_STATUS.DRAFT ||
                  product.status === PRODUCT_STATUS.RETURNED) && (
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
    );

    return columns;
  }, [appliedSearch, busy, canManage, isOwner, mode]);

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

    if (!isOwner && draftFilters.localityId && draftFilters.unmappedLocality) {
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
    applySearch({ page: 1, limit: pageSize });
  }

  const appliedChips: Array<{ key: string; label: string }> = [];
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
  if (!isOwner && appliedSearch.registrantQ) {
    appliedChips.push({ key: 'registrantQ', label: `Người đăng ký: ${appliedSearch.registrantQ}` });
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
  if (!isOwner && appliedSearch.localityId) {
    const locLabel =
      localities.find((item) => item.id === appliedSearch.localityId)?.name ??
      (selectedLocality?.id === appliedSearch.localityId
        ? selectedLocality.name
        : appliedSearch.localityId);
    appliedChips.push({ key: 'localityId', label: `Địa bàn: ${locLabel}` });
  }
  if (!isOwner && appliedSearch.unmappedLocality) {
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

  const hasActiveFilters = appliedChips.length > 0 || Boolean(appliedSearch.status);
  const currentCategoryOptionMissing =
    Boolean(draftFilters.categoryId) &&
    !categories.some((item) => item.id === draftFilters.categoryId);
  const currentLocalityOptionMissing =
    !isOwner &&
    Boolean(draftFilters.localityId) &&
    !localities.some((item) => item.id === draftFilters.localityId);

  const pageTitle = isOwner
    ? 'Hồ sơ của tôi'
    : mode === PRODUCT_WORKSPACE_MODE.PRODUCTS
      ? 'Sản phẩm OCOP'
      : 'Phiếu đăng ký';
  const pageDescription = isOwner
    ? 'Theo dõi hồ sơ sản phẩm, tiến độ chấm điểm và mức sao đạt được.'
    : mode === PRODUCT_WORKSPACE_MODE.PRODUCTS
      ? 'Theo dõi hồ sơ, tiến độ chấm và mức sao theo điểm.'
      : 'Nhập và quản lý phiếu đăng ký cho người đăng ký.';

  const headerActions = isOwner ? (
    <Button asChild>
      <Link to='/my/products/new'>
        <Plus className='size-4' aria-hidden='true' />
        <span>Tạo hồ sơ</span>
      </Link>
    </Button>
  ) : canManage ? (
    <Button asChild>
      <Link to='/admin/registrations/new' search={appliedSearch}>
        <Plus className='size-4' aria-hidden='true' />
        <span>
          {mode === PRODUCT_WORKSPACE_MODE.PRODUCTS ? 'Thêm phiếu đăng ký' : 'Nhập phiếu đăng ký'}
        </span>
      </Link>
    </Button>
  ) : undefined;

  return (
    <PageContainer>
      <PageHeader title={pageTitle} description={pageDescription} actions={headerActions} />

      {isOwner && !loading && !error && ownerStatusCounts.RETURNED > 0 && (
        <div className='registrant-returned-banner' role='status'>
          <div>
            <strong>
              Có {ownerStatusCounts.RETURNED} hồ sơ bị trả lại cần bổ sung hoặc chỉnh sửa
            </strong>
            <p>
              Vui lòng mở hồ sơ để xem lý do trả lại, cập nhật thông tin minh chứng và nộp lại cho
              hội đồng.
            </p>
          </div>
          {appliedSearch.status !== PRODUCT_STATUS.RETURNED && (
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={() => handleStatusSelect(PRODUCT_STATUS.RETURNED)}
            >
              Xem hồ sơ bị trả lại ({ownerStatusCounts.RETURNED})
            </Button>
          )}
        </div>
      )}

      {isOwner && !loading && !error && ownerStatusCounts.total > 0 && (
        <div
          className='registrant-summary-strip'
          role='group'
          aria-label='Tóm tắt số lượng hồ sơ theo trạng thái'
        >
          <button
            type='button'
            className='registrant-summary-card'
            aria-pressed={!appliedSearch.status}
            onClick={() => handleStatusSelect(undefined)}
          >
            <span>Tất cả hồ sơ</span>
            <strong>{ownerStatusCounts.total}</strong>
          </button>
          <button
            type='button'
            className='registrant-summary-card'
            aria-pressed={appliedSearch.status === PRODUCT_STATUS.DRAFT}
            onClick={() => handleStatusSelect(PRODUCT_STATUS.DRAFT)}
          >
            <span>{REGISTRANT_PRODUCT_STATUS_LABEL.DRAFT}</span>
            <strong>{ownerStatusCounts.DRAFT}</strong>
          </button>
          <button
            type='button'
            className='registrant-summary-card'
            aria-pressed={appliedSearch.status === PRODUCT_STATUS.SUBMITTED}
            onClick={() => handleStatusSelect(PRODUCT_STATUS.SUBMITTED)}
          >
            <span>{REGISTRANT_PRODUCT_STATUS_LABEL.SUBMITTED}</span>
            <strong>{ownerStatusCounts.SUBMITTED}</strong>
          </button>
          <button
            type='button'
            className='registrant-summary-card'
            aria-pressed={appliedSearch.status === PRODUCT_STATUS.RETURNED}
            onClick={() => handleStatusSelect(PRODUCT_STATUS.RETURNED)}
          >
            <span>{REGISTRANT_PRODUCT_STATUS_LABEL.RETURNED}</span>
            <strong>{ownerStatusCounts.RETURNED}</strong>
          </button>
          <button
            type='button'
            className='registrant-summary-card'
            aria-pressed={appliedSearch.status === PRODUCT_STATUS.SCORING}
            onClick={() => handleStatusSelect(PRODUCT_STATUS.SCORING)}
          >
            <span>{REGISTRANT_PRODUCT_STATUS_LABEL.SCORING}</span>
            <strong>{ownerStatusCounts.SCORING}</strong>
          </button>
          <button
            type='button'
            className='registrant-summary-card'
            aria-pressed={appliedSearch.status === PRODUCT_STATUS.COMPLETED}
            onClick={() => handleStatusSelect(PRODUCT_STATUS.COMPLETED)}
          >
            <span>{REGISTRANT_PRODUCT_STATUS_LABEL.COMPLETED}</span>
            <strong>{ownerStatusCounts.COMPLETED}</strong>
          </button>
        </div>
      )}

      <div className='status-tabs' role='group' aria-label='Lọc nhanh theo trạng thái hồ sơ'>
        {statusOptions.map((option) => {
          const pressed = (appliedSearch.status ?? undefined) === option.value;
          const count = isOwner
            ? option.value
              ? ownerStatusCounts[option.value]
              : ownerStatusCounts.total
            : undefined;
          return (
            <button
              key={option.value ?? ALL}
              type='button'
              aria-pressed={pressed}
              className={`tab-item ${pressed ? 'active' : ''}`}
              onClick={() => handleStatusSelect(option.value)}
            >
              {option.label}
              {count !== undefined && !loading ? ` (${count})` : ''}
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
            <Combobox
              value={draftFilters.categoryId ?? ALL}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  categoryId: value === ALL ? undefined : value,
                }))
              }
            >
              <ComboboxAnchor>
                <ComboboxInput id='admin-product-category' placeholder='Tất cả danh mục' />
                <ComboboxTrigger aria-label='Mở danh sách danh mục' />
              </ComboboxAnchor>
              <ComboboxContent>
                <ComboboxEmpty>Không tìm thấy danh mục phù hợp.</ComboboxEmpty>
                <ComboboxItem value={ALL}>Tất cả danh mục</ComboboxItem>
                {currentCategoryOptionMissing && draftFilters.categoryId && (
                  <ComboboxItem value={draftFilters.categoryId}>
                    {selectedCategoryDetail.data?.data.id === draftFilters.categoryId
                      ? selectedCategoryDetail.data.data.name
                      : `Mã danh mục: ${draftFilters.categoryId}`}
                  </ComboboxItem>
                )}
                {categories.map((category) => (
                  <ComboboxItem key={category.id} value={category.id}>
                    {category.name}
                  </ComboboxItem>
                ))}
              </ComboboxContent>
            </Combobox>
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
              {appliedChips.length > 0 && (
                <span className='admin-filter-count'>{appliedChips.length}</span>
              )}
            </Button>
            {appliedChips.length > 0 && (
              <Button type='button' variant='secondary' onClick={resetFilters}>
                <RotateCcw className='size-4' aria-hidden='true' />
                <span>Xóa bộ lọc</span>
              </Button>
            )}
          </div>
        </div>

        <div id='admin-product-advanced' hidden={!showAdvanced} className='advanced-filter-grid'>
          {!isOwner && (
            <FormField
              label='Từ khóa người đăng ký (tên hoặc email)'
              htmlFor='admin-product-registrant-q'
            >
              <Input
                id='admin-product-registrant-q'
                placeholder='Nhập tên hoặc email người đăng ký…'
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
          )}

          <FormField label='Loại đăng ký' htmlFor='admin-product-registration-type'>
            <Combobox
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
              <ComboboxAnchor>
                <ComboboxInput
                  id='admin-product-registration-type'
                  placeholder='Tất cả loại đăng ký'
                />
                <ComboboxTrigger aria-label='Mở danh sách loại đăng ký' />
              </ComboboxAnchor>
              <ComboboxContent>
                <ComboboxEmpty>Không tìm thấy loại đăng ký.</ComboboxEmpty>
                <ComboboxItem value={ALL}>Tất cả loại đăng ký</ComboboxItem>
                <ComboboxItem value={PRODUCT_REGISTRATION_TYPE.FIRST}>Lần đầu</ComboboxItem>
                <ComboboxItem value={PRODUCT_REGISTRATION_TYPE.UPGRADE}>Nâng hạng</ComboboxItem>
                <ComboboxItem value={PRODUCT_REGISTRATION_TYPE.REASSESSMENT}>
                  Đánh giá lại
                </ComboboxItem>
              </ComboboxContent>
            </Combobox>
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
            <Combobox
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
              <ComboboxAnchor>
                <ComboboxInput id='admin-product-star-rating' placeholder='Tất cả mức sao' />
                <ComboboxTrigger aria-label='Mở danh sách mức sao' />
              </ComboboxAnchor>
              <ComboboxContent>
                <ComboboxEmpty>Không tìm thấy mức sao.</ComboboxEmpty>
                <ComboboxItem value={ALL}>Tất cả mức sao</ComboboxItem>
                <ComboboxItem value='1'>Mức điểm 1 sao</ComboboxItem>
                <ComboboxItem value='2'>Mức điểm 2 sao</ComboboxItem>
                <ComboboxItem value='3'>Mức điểm 3 sao</ComboboxItem>
                <ComboboxItem value='4'>Mức điểm 4 sao</ComboboxItem>
                <ComboboxItem value='5'>Mức điểm 5 sao / Đề nghị xem xét 5 sao</ComboboxItem>
              </ComboboxContent>
            </Combobox>
          </FormField>

          {!isOwner && (
            <div className='form-group'>
              <Label htmlFor='admin-product-locality-province'>Tỉnh / Thành phố</Label>
              <Combobox
                value={localityProvince || ALL}
                disabled={Boolean(draftFilters.unmappedLocality)}
                onValueChange={(value) => {
                  const nextProvince = value === ALL ? '' : value;
                  setLocalityProvince(nextProvince);
                  setLocalitySearch('');
                  setLocalityPage(1);
                  setSelectedLocality(null);
                  setDraftFilters((old) => ({
                    ...old,
                    localityId: undefined,
                  }));
                }}
              >
                <ComboboxAnchor>
                  <ComboboxInput
                    id='admin-product-locality-province'
                    placeholder='Chọn tỉnh / thành phố trước'
                  />
                  <ComboboxTrigger aria-label='Mở danh sách tỉnh / thành phố' />
                </ComboboxAnchor>
                <ComboboxContent>
                  <ComboboxEmpty>Không tìm thấy tỉnh / thành phố.</ComboboxEmpty>
                  <ComboboxItem value={ALL}>Tất cả tỉnh / thành phố</ComboboxItem>
                  {ADMINISTRATIVE_PROVINCES.map((province) => (
                    <ComboboxItem key={province.code} value={province.name_with_type}>
                      {province.name_with_type}
                    </ComboboxItem>
                  ))}
                </ComboboxContent>
              </Combobox>
              <Label htmlFor='admin-product-locality-select' className='mt-2'>
                Địa bàn hành chính (xã / phường)
              </Label>
              <Combobox
                value={draftFilters.localityId ?? ALL}
                disabled={
                  Boolean(draftFilters.unmappedLocality) ||
                  (!localityProvince && !draftFilters.localityId)
                }
                onValueChange={(value) => {
                  const id = value === ALL ? '' : value;
                  const found = localities.find((loc) => loc.id === id) ?? null;
                  setSelectedLocality(found);
                  if (found && !localityProvince) {
                    setLocalityProvince(found.provinceName);
                  }
                  setDraftFilters((old) => ({
                    ...old,
                    localityId: id || undefined,
                    unmappedLocality: id ? undefined : old.unmappedLocality,
                  }));
                }}
              >
                <ComboboxAnchor>
                  <ComboboxInput
                    id='admin-product-locality-select'
                    placeholder={
                      localityProvince
                        ? 'Tất cả xã / phường trong tỉnh'
                        : 'Chọn tỉnh / thành phố trước'
                    }
                  />
                  <ComboboxTrigger aria-label='Mở danh sách địa bàn' />
                </ComboboxAnchor>
                <ComboboxContent>
                  <ComboboxEmpty>Không tìm thấy địa bàn phù hợp.</ComboboxEmpty>
                  <ComboboxItem value={ALL}>Tất cả địa bàn</ComboboxItem>
                  {currentLocalityOptionMissing && draftFilters.localityId && (
                    <ComboboxItem value={draftFilters.localityId}>
                      {selectedLocality?.id === draftFilters.localityId
                        ? `${selectedLocality.name} · ${selectedLocality.provinceName}`
                        : `Mã địa bàn: ${draftFilters.localityId}`}
                    </ComboboxItem>
                  )}
                  {localities.map((locality) => (
                    <ComboboxItem key={locality.id} value={locality.id}>
                      {locality.name} · {locality.provinceName}
                    </ComboboxItem>
                  ))}
                </ComboboxContent>
              </Combobox>
              <Label htmlFor='admin-product-locality-search' className='mt-2'>
                Tìm nhanh xã / phường
              </Label>
              <Input
                id='admin-product-locality-search'
                placeholder={
                  localityProvince
                    ? 'Nhập tên hoặc mã xã / phường…'
                    : 'Chọn tỉnh / thành phố trước…'
                }
                value={localitySearch}
                disabled={!localityProvince || Boolean(draftFilters.unmappedLocality)}
                maxLength={100}
                onChange={(event) => {
                  setLocalitySearch(event.target.value);
                  setLocalityPage(1);
                }}
              />
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
          )}

          <FormField label='Căn cứ lọc ngày' htmlFor='admin-product-date-basis'>
            <Combobox
              value={draftFilters.dateBasis ?? PRODUCT_DATE_BASIS.SUBMITTED_AT}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  dateBasis: value as
                    typeof PRODUCT_DATE_BASIS.SUBMITTED_AT | typeof PRODUCT_DATE_BASIS.COMPLETED_AT,
                }))
              }
            >
              <ComboboxAnchor>
                <ComboboxInput id='admin-product-date-basis' />
                <ComboboxTrigger aria-label='Mở danh sách căn cứ lọc ngày' />
              </ComboboxAnchor>
              <ComboboxContent>
                <ComboboxEmpty>Không tìm thấy căn cứ lọc ngày.</ComboboxEmpty>
                <ComboboxItem value={PRODUCT_DATE_BASIS.SUBMITTED_AT}>Ngày nộp</ComboboxItem>
                <ComboboxItem value={PRODUCT_DATE_BASIS.COMPLETED_AT}>Ngày hoàn tất</ComboboxItem>
              </ComboboxContent>
            </Combobox>
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
            <Combobox
              value={draftFilters.sortBy ?? PRODUCT_SORT_BY.SUBMITTED_AT}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  sortBy: value as AdminProductQuery['sortBy'],
                }))
              }
            >
              <ComboboxAnchor>
                <ComboboxInput id='admin-product-sort-by' />
                <ComboboxTrigger aria-label='Mở danh sách tiêu chí sắp xếp' />
              </ComboboxAnchor>
              <ComboboxContent>
                <ComboboxEmpty>Không tìm thấy tiêu chí sắp xếp.</ComboboxEmpty>
                <ComboboxItem value={PRODUCT_SORT_BY.SUBMITTED_AT}>Ngày nộp</ComboboxItem>
                <ComboboxItem value={PRODUCT_SORT_BY.NAME}>Tên sản phẩm</ComboboxItem>
                <ComboboxItem value={PRODUCT_SORT_BY.FINAL_SCORE}>Điểm số</ComboboxItem>
              </ComboboxContent>
            </Combobox>
          </FormField>

          <FormField label='Thứ tự sắp xếp' htmlFor='admin-product-sort-direction'>
            <Combobox
              value={draftFilters.sortDirection ?? SORT_DIRECTION.DESC}
              onValueChange={(value) =>
                setDraftFilters((old) => ({
                  ...old,
                  sortDirection: value as AdminProductQuery['sortDirection'],
                }))
              }
            >
              <ComboboxAnchor>
                <ComboboxInput id='admin-product-sort-direction' />
                <ComboboxTrigger aria-label='Mở danh sách thứ tự sắp xếp' />
              </ComboboxAnchor>
              <ComboboxContent>
                <ComboboxEmpty>Không tìm thấy thứ tự sắp xếp.</ComboboxEmpty>
                <ComboboxItem value={SORT_DIRECTION.DESC}>Giảm dần</ComboboxItem>
                <ComboboxItem value={SORT_DIRECTION.ASC}>Tăng dần</ComboboxItem>
              </ComboboxContent>
            </Combobox>
          </FormField>
        </div>

        {filterError && <AlertError title='Bộ lọc chưa hợp lệ' errors={[filterError]} />}

        {appliedChips.length > 0 && (
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
              isOwner
                ? 'Không thể tải hồ sơ'
                : mode === PRODUCT_WORKSPACE_MODE.PRODUCTS
                  ? 'Không tải được danh sách sản phẩm'
                  : 'Không tải được danh sách phiếu đăng ký'
            }
            errors={[error]}
          />
          <Button
            type='button'
            variant='secondary'
            size='sm'
            disabled={loading || busy}
            onClick={() => void refetch()}
          >
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
              aria-label={
                isOwner
                  ? 'Bảng hồ sơ của tôi'
                  : mode === PRODUCT_WORKSPACE_MODE.PRODUCTS
                    ? 'Bảng sản phẩm OCOP'
                    : 'Bảng phiếu đăng ký OCOP'
              }
              tabIndex={0}
              aria-busy={isFetching}
            >
              <p className='admin-table-scroll-hint'>
                Vuốt hoặc dùng phím mũi tên ngang để xem đầy đủ các cột.
              </p>
              <DataTable
                columns={productColumns}
                data={data}
                total={totalCount}
                page={currentPage}
                pageSize={pageSize}
                enableSorting
                sorting={sorting}
                onSortingChange={setSorting}
                getRowId={(row) => row.id}
                onPageChange={(nextPage) => changePage(nextPage)}
                onPageSizeChange={(nextLimit) => setPageSize(nextLimit)}
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
                    {isOwner
                      ? 'Chưa có hồ sơ'
                      : mode === PRODUCT_WORKSPACE_MODE.PRODUCTS
                        ? 'Chưa có hồ sơ sản phẩm nào'
                        : 'Chưa có phiếu đăng ký nào'}
                  </h2>
                  <p className='text-muted text-sm'>
                    {isOwner
                      ? 'Tạo bản nháp để bắt đầu đăng ký sản phẩm OCOP.'
                      : mode === PRODUCT_WORKSPACE_MODE.PRODUCTS
                        ? 'Khi người đăng ký nộp hồ sơ hoặc quản trị viên nhập hộ phiếu đăng ký, sản phẩm sẽ hiển thị tại đây.'
                        : 'Bắt đầu bằng cách nhập phiếu đăng ký mới cho người đăng ký.'}
                  </p>
                  {isOwner ? (
                    <div className='admin-actions mt-4 justify-center'>
                      <Button asChild>
                        <Link to='/my/products/new'>
                          <Plus className='size-4' aria-hidden='true' />
                          <span>Tạo hồ sơ</span>
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    canManage && (
                      <div className='admin-actions mt-4 justify-center'>
                        <Button asChild>
                          <Link to='/admin/registrations/new' search={appliedSearch}>
                            <Plus className='size-4' aria-hidden='true' />
                            <span>
                              {mode === PRODUCT_WORKSPACE_MODE.PRODUCTS
                                ? 'Thêm phiếu đăng ký'
                                : 'Nhập phiếu đăng ký'}
                            </span>
                          </Link>
                        </Button>
                      </div>
                    )
                  )}
                </>
              )}
            </Card>
          )}
        </>
      )}

      {isOwner &&
        (() => {
          const confirmSubmitIssues =
            confirmState?.mode === ADMIN_MODAL_ACTION.SUBMIT
              ? getSavedProductSubmitIssues(confirmState.product)
              : [];
          return (
            <ConfirmDialog
              open={confirmState !== null}
              onOpenChange={(open) => {
                if (!open && !busy) {
                  setConfirmState(null);
                  setActionError('');
                }
              }}
              title={
                confirmState?.mode === ADMIN_MODAL_ACTION.DELETE
                  ? `Xóa bản nháp: ${confirmState.product.name}`
                  : `Nộp hồ sơ: ${confirmState?.product.name ?? ''}`
              }
              description={
                confirmState?.mode === ADMIN_MODAL_ACTION.DELETE
                  ? 'Bản nháp sản phẩm sẽ bị xóa vĩnh viễn và không thể khôi phục.'
                  : confirmSubmitIssues.length > 0
                    ? 'Hồ sơ chưa đủ thông tin đã lưu. Hãy mở trang sửa bản nháp để bổ sung và lưu trước khi nộp.'
                    : 'Nộp hồ sơ này để bắt đầu đánh giá? Sau khi nộp, không thể sửa bản nháp.'
              }
              confirmLabel={
                confirmState?.mode === ADMIN_MODAL_ACTION.DELETE ? 'Xóa bản nháp' : 'Nộp hồ sơ'
              }
              destructive={confirmState?.mode === ADMIN_MODAL_ACTION.DELETE}
              pending={busy}
              confirmDisabled={
                confirmState?.mode === ADMIN_MODAL_ACTION.SUBMIT && confirmSubmitIssues.length > 0
              }
              error={confirmSubmitIssues.length > 0 ? confirmSubmitIssues : actionError}
              onConfirm={() => void executeOwnerConfirm()}
            />
          );
        })()}
      <ImagePreviewDialog
        items={previewGallery?.items ?? []}
        activeIndex={previewGallery ? previewGallery.index : null}
        onIndexChange={(nextIndex) => {
          if (nextIndex === null) {
            setPreviewGallery(null);
          } else {
            setPreviewGallery((prev) => (prev ? { ...prev, index: nextIndex } : null));
          }
        }}
        contextLabel={previewGallery?.label}
      />
    </PageContainer>
  );
}
