import { useRef, useState } from 'react';
import { PageContainer, PageHeader, PageSection } from '@/layouts/PageLayout';
import type { ProductStatus } from '@ocop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useBlocker, useNavigate } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Maximize2,
  RotateCcw,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import AlertError from '@/components/alert-error';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { ImagePreviewDialog } from '@/components/image-preview-dialog';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { myProductsApi } from '../../api';
import type { AddProductJudgeAssignmentResponse } from '../../api/admin-products';
import {
  ADMIN_MODAL_ACTION,
  ADMIN_PRODUCT_DETAIL_TAB,
  ALL,
  ATTACHMENT_TYPE,
  EVALUATION_STATUS,
  PRODUCT_PUBLICATION_STATE,
  PRODUCT_STATUS,
  PRODUCT_WORKSPACE_MODE,
  STAFF_PERMISSION,
} from '../../constants/consts';
import {
  ADMIN_DASHBOARD_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
  REGISTRANT_PRODUCT_STATUS_LABEL,
} from '../../constants/product-status';
import { queryKeys } from '../../constants/query-key';
import {
  toAdminProductApiQuery,
  type AdminProductDetailTab,
  type AdminProductSearch,
} from '../../lib/admin-search';
import { errorText, messageOf } from '../../lib/api-error';
import { MAX_PRODUCT_ATTACHMENTS } from '../../lib/attachments';
import { useSession } from '../../lib/auth';
import {
  displayProductCode,
  formatExactScore,
  formatStarRatingLabel,
} from '../../lib/print-format';
import { getSavedProductSubmitIssues } from '../../lib/save-product-draft';
import { hasStaffPermission } from '../../lib/session-contract';
import { formatFormEntries } from '../../lib/utils';
import {
  AttachmentLink,
  openProductAttachmentByMode,
  PrivateAttachmentThumbnail,
} from '../../pages/registrant/AttachmentLink';
import {
  useAdminProductDetail,
  useAdminProductMutations,
  useProductEligibleJudges,
  type AdminProductMode,
} from '../../queries/admin-products';
import { useMyProduct } from '../../queries/registrant';
import type { RegistrantProduct } from '../../types/registrant';
import { AdminProductResultsPage } from './AdminProductResultsPage';

interface AdminProductDetailPageProps {
  productId: string;
  mode: AdminProductMode | typeof PRODUCT_WORKSPACE_MODE.OWNER;
  search?: AdminProductSearch;
  onSearchChange?: (next: AdminProductSearch) => void;
}

const VALID_TABS: readonly AdminProductDetailTab[] = [
  ADMIN_PRODUCT_DETAIL_TAB.INFORMATION,
  ADMIN_PRODUCT_DETAIL_TAB.REGISTRATION,
  ADMIN_PRODUCT_DETAIL_TAB.FILES,
  ADMIN_PRODUCT_DETAIL_TAB.PROGRESS,
  ADMIN_PRODUCT_DETAIL_TAB.RESULTS,
];

function formatStatusLabel(
  status: ProductStatus | string | null | undefined,
  isOwner = false,
): string {
  if (!status) return 'Mới tạo';
  if (isOwner) {
    return REGISTRANT_PRODUCT_STATUS_LABEL[status as ProductStatus] ?? status;
  }
  return ADMIN_DASHBOARD_STATUS_LABEL[status as ProductStatus] ?? status;
}

function formatAttachmentType(
  type?: typeof ATTACHMENT_TYPE.IMAGE | typeof ATTACHMENT_TYPE.EVIDENCE,
): string {
  if (type === ATTACHMENT_TYPE.IMAGE) return 'Hình ảnh sản phẩm';
  if (type === ATTACHMENT_TYPE.EVIDENCE) return 'Tài liệu minh chứng';
  return 'Tệp đính kèm';
}

function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  if (idx <= 0 || idx === fileName.length - 1) return 'FILE';
  return fileName
    .slice(idx + 1)
    .toUpperCase()
    .slice(0, 6);
}

type AdminModalKind = (typeof ADMIN_MODAL_ACTION)[keyof typeof ADMIN_MODAL_ACTION] | null;

export function AdminProductDetailPage({
  productId,
  mode,
  search = { page: 1, limit: 20 },
  onSearchChange,
}: AdminProductDetailPageProps) {
  const isOwner = mode === PRODUCT_WORKSPACE_MODE.OWNER;
  const adminMode: AdminProductMode = isOwner ? PRODUCT_WORKSPACE_MODE.REGISTRATIONS : mode;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, STAFF_PERMISSION.MANAGE);
  const canView = hasStaffPermission(session?.user, STAFF_PERMISSION.VIEW);
  const [fallbackTab, setFallbackTab] = useState<AdminProductDetailTab>(
    ADMIN_PRODUCT_DETAIL_TAB.INFORMATION,
  );

  const rawTab = search.tab ?? fallbackTab;
  const selectedTab: AdminProductDetailTab = VALID_TABS.includes(rawTab)
    ? rawTab
    : ADMIN_PRODUCT_DETAIL_TAB.INFORMATION;
  const listSearch = toAdminProductApiQuery(search);
  const listPath =
    mode === PRODUCT_WORKSPACE_MODE.OWNER
      ? '/my/products'
      : mode === PRODUCT_WORKSPACE_MODE.PRODUCTS
        ? '/admin/products'
        : '/admin/registrations';
  const printSearch = { ...search, returnMode: adminMode };

  function changeDetailTab(value: string) {
    const nextTab = (
      VALID_TABS.includes(value as AdminProductDetailTab)
        ? value
        : ADMIN_PRODUCT_DETAIL_TAB.INFORMATION
    ) as AdminProductDetailTab;
    if (onSearchChange) {
      onSearchChange({ ...search, tab: nextTab });
    } else {
      setFallbackTab(nextTab);
    }
  }

  const adminQuery = useAdminProductDetail(adminMode, canManage, productId, !isOwner);
  const ownerQuery = useMyProduct(isOwner ? productId : undefined);
  const judgesQuery = useProductEligibleJudges(productId, !isOwner && canView);

  const adminProduct = !isOwner ? adminQuery.data?.data : undefined;
  const ownerProduct = isOwner ? ownerQuery.data : undefined;
  const product = adminProduct ?? ownerProduct;
  const loadError = isOwner ? ownerQuery.error : adminQuery.error;
  const isPending = isOwner ? ownerQuery.isPending : adminQuery.isPending;
  const refetch = isOwner ? ownerQuery.refetch : adminQuery.refetch;

  const actions = useAdminProductMutations(productId, adminMode, canManage);

  const [confirmAction, setConfirmAction] = useState<AdminModalKind>(null);
  const [removingAttachment, setRemovingAttachment] = useState<{
    id: string;
    fileName: string;
  } | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Manual Judge Assignment state
  const [selectedAddJudgeId, setSelectedAddJudgeId] = useState('');
  const [addJudgeReason, setAddJudgeReason] = useState('');
  const [restoreConfirmPrompt, setRestoreConfirmPrompt] = useState<{
    judgeId: string;
    reason?: string;
    previousEvaluation: AddProductJudgeAssignmentResponse['previousEvaluation'];
  } | null>(null);

  const savedNavigation = useRef(false);

  const hasDirtyReason =
    !isOwner && (confirmAction !== null || removingAttachment !== null) && reason.trim().length > 0;

  useBlocker({
    shouldBlockFn: () =>
      !savedNavigation.current &&
      hasDirtyReason &&
      !window.confirm('Lý do thao tác chưa được thực hiện. Rời trang và bỏ nội dung đã nhập?'),
    enableBeforeUnload: () => hasDirtyReason && !savedNavigation.current,
  });

  function requestCloseDialog() {
    if (busy) return;
    if (
      !isOwner &&
      reason.trim().length > 0 &&
      !window.confirm('Bạn đã nhập lý do thao tác. Đóng hộp thoại và bỏ nội dung đã nhập?')
    ) {
      return;
    }
    setConfirmAction(null);
    setRemovingAttachment(null);
    setReason('');
    setError('');
  }

  async function runAdmin(
    action: (confirmedReason: string) => Promise<unknown>,
    options: {
      returnToList?: boolean;
      requireReason?: boolean;
      successText?: string;
    } = {},
  ) {
    const trimmedReason = reason.trim();
    if (busy) return;
    if (options.requireReason !== false && !trimmedReason) {
      setError('Nhập lý do thao tác trước khi tiếp tục.');
      return;
    }
    setBusy(true);
    setError('');
    setStatusNote('');
    try {
      await action(trimmedReason);
      if (options.returnToList) {
        savedNavigation.current = true;
        try {
          setConfirmAction(null);
          setReason('');
          await navigate({ to: listPath, search: listSearch });
          return;
        } finally {
          savedNavigation.current = false;
        }
      }
      await refetch();
      setConfirmAction(null);
      setRemovingAttachment(null);
      setReason('');
      if (options.successText) setStatusNote(options.successText);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddJudge(confirmRestore = false) {
    const targetJudgeId = confirmRestore ? restoreConfirmPrompt?.judgeId : selectedAddJudgeId;
    const targetReason = confirmRestore
      ? restoreConfirmPrompt?.reason
      : addJudgeReason.trim() || undefined;
    if (!targetJudgeId || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await actions.addAssignment({
        judgeId: targetJudgeId,
        reason: targetReason,
        confirmRestore,
      });
      if ('requiresRestoreConfirmation' in res.data && res.data.requiresRestoreConfirmation) {
        setRestoreConfirmPrompt({
          judgeId: targetJudgeId,
          reason: targetReason,
          previousEvaluation: res.data.previousEvaluation,
        });
        return;
      }
      setRestoreConfirmPrompt(null);
      setSelectedAddJudgeId('');
      setAddJudgeReason('');
      await refetch();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  async function submitOwner() {
    if (busy || !product) return;
    const issues = getSavedProductSubmitIssues(product);
    if (issues.length > 0) {
      setError(issues[0]);
      toast.error(issues[0]);
      return;
    }
    setBusy(true);
    setError('');
    setStatusNote('');
    try {
      const { data } = await myProductsApi.submit(productId);
      queryClient.setQueryData(queryKeys.myProducts.detail(productId), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myProducts.list });
      setConfirmAction(null);
      setStatusNote('Đã nộp hồ sơ tới hội đồng đánh giá.');
      toast.success('Đã nộp hồ sơ tới hội đồng đánh giá.');
    } catch (cause) {
      const msg = messageOf(cause);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function removeOwner() {
    if (busy) return;
    setBusy(true);
    setError('');
    setStatusNote('');
    try {
      await myProductsApi.remove(productId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myProducts.all });
      setConfirmAction(null);
      toast.success('Đã xóa bản nháp sản phẩm.');
      await navigate({ to: '/my/products' });
    } catch (cause) {
      const msg = messageOf(cause);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function removeOwnerAttachment(attachmentId: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setStatusNote('');
    try {
      await myProductsApi.removeAttachment(productId, attachmentId);
      queryClient.setQueryData<RegistrantProduct>(
        queryKeys.myProducts.detail(productId),
        (current) =>
          current
            ? {
                ...current,
                attachments: current.attachments.filter((file) => file.id !== attachmentId),
              }
            : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.myProducts.list });
      setRemovingAttachment(null);
      setStatusNote('Đã xóa tệp đính kèm.');
      toast.success('Đã xóa tệp đính kèm.');
    } catch (cause) {
      const msg = messageOf(cause);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const visibleError = error || errorText(loadError);

  if (isPending && !product) {
    return (
      <PageContainer aria-busy='true'>
        <PageSpin />
      </PageContainer>
    );
  }

  if (!product) {
    return (
      <PageContainer>
        <AlertError
          title='Không thể tải hồ sơ'
          errors={[visibleError || 'Không tìm thấy hồ sơ hoặc bạn không có quyền xem.']}
        />
        <div className='admin-actions'>
          <Button type='button' variant='secondary' onClick={() => void refetch()}>
            Thử lại
          </Button>
          <Button asChild variant='secondary'>
            {isOwner ? (
              <Link to='/my/products'>Quay lại danh sách</Link>
            ) : (
              <Link to={listPath} search={listSearch}>
                Quay lại danh sách
              </Link>
            )}
          </Button>
        </div>
      </PageContainer>
    );
  }

  const isDraft = product.status === PRODUCT_STATUS.DRAFT;
  const isReturned = product.status === PRODUCT_STATUS.RETURNED;
  const isEditable = isDraft || isReturned;
  const savedSubmitIssues = isEditable ? getSavedProductSubmitIssues(product) : [];
  const isSubmitted = product.status === PRODUCT_STATUS.SUBMITTED;
  const isCompleted = product.status === PRODUCT_STATUS.COMPLETED;
  const isScoringOrApproved =
    product.status === PRODUCT_STATUS.APPROVED || product.status === PRODUCT_STATUS.SCORING;
  const isPublished = product.publicationState === PRODUCT_PUBLICATION_STATE.PUBLISHED;
  const isUpdatingResult = product.publicationState === PRODUCT_PUBLICATION_STATE.UPDATING;
  const resultReady =
    isCompleted && typeof product.finalScore === 'number' && (!isOwner || isPublished);

  const formEntries = formatFormEntries(product.formData);
  const attachmentMode = isOwner ? PRODUCT_WORKSPACE_MODE.OWNER : PRODUCT_WORKSPACE_MODE.ADMIN;
  const imageAttachments = product.attachments.filter(
    (file) => file.type === ATTACHMENT_TYPE.IMAGE,
  );
  const documentAttachments = product.attachments.filter(
    (file) => file.type !== ATTACHMENT_TYPE.IMAGE,
  );
  const activePreviewImage =
    previewImageIndex !== null ? (imageAttachments[previewImageIndex] ?? null) : null;
  const statusTone = PRODUCT_STATUS_TONE[product.status] ?? 'status-badge';
  const registrantName = adminProduct
    ? adminProduct.registrant.fullName
    : (session?.user.fullName ?? 'Chủ thể đăng ký');
  const registrantEmail = adminProduct
    ? adminProduct.registrant.email
    : (session?.user.email ?? '');
  const registrantPhone = adminProduct
    ? adminProduct.registrant.phone
    : (session?.user.phone ?? null);

  // Eligible judges for manual assignment on this product
  const requiredAgencyIds = new Set(
    (adminProduct?.agencyCoverage ?? []).map((item) => item.agency.id),
  );
  const activeAssignedJudgeIds = new Set(
    (adminProduct?.judgeAssignments ?? []).filter((a) => a.isActive).map((a) => a.judgeId),
  );
  const allJudges = (judgesQuery.data ?? []) as Array<{
    id: string;
    fullName: string;
    email: string;
    isActive: boolean;
    verified: boolean;
    organizationUnit?: {
      id: string;
      code: string;
      name: string;
      managingAgencyId?: string | null;
      managingAgency?: { id: string; code: string; name: string } | null;
    } | null;
  }>;
  const eligibleManualJudges = allJudges.filter((j) => {
    if (!j.isActive || !j.verified || activeAssignedJudgeIds.has(j.id)) return false;
    if (requiredAgencyIds.size === 0) return true;
    const jAgencyId =
      j.organizationUnit?.managingAgencyId ?? j.organizationUnit?.managingAgency?.id ?? null;
    return Boolean(jAgencyId && requiredAgencyIds.has(jAgencyId));
  });

  return (
    <PageContainer>
      <PageHeader
        backLink={
          isOwner ? (
            <Link className='text-link text-sm' to='/my/products'>
              <ArrowLeft size={16} aria-hidden='true' /> Quay lại danh sách
            </Link>
          ) : (
            <Link className='text-link text-sm' to={listPath} search={listSearch}>
              <ArrowLeft size={16} aria-hidden='true' /> Quay lại danh sách
            </Link>
          )
        }
        title={product.name}
        badge={
          <Badge variant='outline' className={statusTone}>
            {formatStatusLabel(product.status, isOwner)}
          </Badge>
        }
        description={
          <>
            Mã hồ sơ: <span className='font-mono text-xs'>{displayProductCode(product)}</span> ·
            Người đăng ký: <strong>{registrantName}</strong>
            {registrantEmail ? ` (${registrantEmail})` : ''} · Phân loại: {product.category.name}
            {product.submittedAt
              ? ` · Ngày nộp: ${new Date(product.submittedAt).toLocaleString('vi-VN')}`
              : ''}
          </>
        }
        actions={
          <>
            <Button asChild variant='outline'>
              {isOwner ? (
                <Link to='/print/products/$id/registration' params={{ id: product.id }}>
                  In phiếu đăng ký
                </Link>
              ) : (
                <Link
                  to='/print/products/$id/registration'
                  params={{ id: product.id }}
                  search={printSearch}
                >
                  In phiếu đăng ký
                </Link>
              )}
            </Button>
            {isOwner
              ? resultReady && (
                  <Button asChild variant='outline'>
                    <Link to='/print/products/$id/results' params={{ id: product.id }}>
                      In kết quả đánh giá
                    </Link>
                  </Button>
                )
              : !isDraft && (
                  <Button asChild variant='outline'>
                    <Link
                      to='/print/products/$id/results'
                      params={{ id: product.id }}
                      search={printSearch}
                    >
                      In bảng tổng hợp kết quả
                    </Link>
                  </Button>
                )}
            {isOwner && isEditable && (
              <>
                <Button asChild variant='secondary'>
                  <Link to='/my/products/$id/edit' params={{ id: product.id }}>
                    {isReturned ? 'Chỉnh sửa hồ sơ' : 'Sửa bản nháp'}
                  </Link>
                </Button>
                <Button
                  type='button'
                  variant='primary'
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setConfirmAction(ADMIN_MODAL_ACTION.SUBMIT);
                  }}
                >
                  {isReturned ? 'Nộp lại hồ sơ' : 'Nộp hồ sơ'}
                </Button>
                {isDraft && (
                  <Button
                    type='button'
                    variant='destructive-outline'
                    disabled={busy}
                    onClick={() => {
                      setError('');
                      setConfirmAction(ADMIN_MODAL_ACTION.DELETE);
                    }}
                  >
                    Xóa bản nháp
                  </Button>
                )}
              </>
            )}
            {!isOwner && canManage && isEditable && (
              <>
                <Button asChild variant='secondary'>
                  <Link
                    to='/admin/registrations/$id/edit'
                    params={{ id: product.id }}
                    search={listSearch}
                  >
                    Sửa phiếu
                  </Link>
                </Button>
                <Button
                  type='button'
                  variant='primary'
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setConfirmAction(ADMIN_MODAL_ACTION.SUBMIT);
                  }}
                >
                  Nộp thay
                </Button>
                {isDraft && (
                  <Button
                    type='button'
                    variant='destructive-outline'
                    disabled={busy}
                    onClick={() => {
                      setError('');
                      setConfirmAction(ADMIN_MODAL_ACTION.DELETE);
                    }}
                  >
                    Xóa bản nháp
                  </Button>
                )}
              </>
            )}
            {!isOwner && canView && isSubmitted && (
              <>
                <Button
                  type='button'
                  variant='primary'
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setReason('');
                    setConfirmAction(ADMIN_MODAL_ACTION.APPROVE);
                  }}
                >
                  Duyệt hồ sơ
                </Button>
                <Button
                  type='button'
                  variant='destructive-outline'
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setReason('');
                    setConfirmAction(ADMIN_MODAL_ACTION.RETURN);
                  }}
                >
                  Trả lại hồ sơ
                </Button>
              </>
            )}
            {!isOwner && canView && isCompleted && (
              <>
                {product.finalScore !== null && (!isPublished || isUpdatingResult) && (
                  <Button
                    type='button'
                    variant='primary'
                    disabled={busy}
                    onClick={() => {
                      setError('');
                      setReason('');
                      setConfirmAction(ADMIN_MODAL_ACTION.PUBLISH);
                    }}
                  >
                    {isUpdatingResult ? 'Công bố lại kết quả' : 'Công bố kết quả'}
                  </Button>
                )}
                <Button
                  type='button'
                  variant='secondary'
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setReason('');
                    setConfirmAction(ADMIN_MODAL_ACTION.REOPEN);
                  }}
                >
                  <RotateCcw className='size-4' aria-hidden='true' />
                  <span>Mở lại hồ sơ</span>
                </Button>
              </>
            )}
          </>
        }
      />

      {product.returnReason && (
        <div
          role='alert'
          className='border-destructive/40 bg-destructive/10 mb-4 rounded-lg border p-4 text-sm'
        >
          <p className='text-destructive font-semibold'>Lý do trả lại hồ sơ:</p>
          <p className='mt-1'>{product.returnReason}</p>
        </div>
      )}

      {!isOwner &&
        adminProduct?.missingAgencyNames &&
        adminProduct.missingAgencyNames.length > 0 &&
        (isScoringOrApproved || isCompleted) && (
          <div
            role='alert'
            className='mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm'
          >
            <AlertTriangle className='mt-0.5 size-4 shrink-0 text-amber-600' aria-hidden='true' />
            <div>
              <p className='font-semibold'>
                Cảnh báo thiếu giám khảo theo cơ quan quản lý của phân loại sản phẩm:
              </p>
              <p className='mt-0.5'>
                Cơ quan chưa có giám khảo đang phân công:{' '}
                <strong>{adminProduct.missingAgencyNames.join(', ')}</strong>. Hãy bổ sung giám khảo
                thuộc đơn vị của cơ quan này trong tab Tiến độ.
              </p>
            </div>
          </div>
        )}

      {statusNote && (
        <p className='form-message' role='status'>
          {statusNote}
        </p>
      )}

      {visibleError && (isOwner || (confirmAction === null && removingAttachment === null)) && (
        <AlertError title='Không thể thực hiện thao tác' errors={[visibleError]} />
      )}

      {isEditable && savedSubmitIssues.length > 0 && (
        <AlertError
          title='Hồ sơ chưa đủ điều kiện nộp (cần bổ sung và lưu trước khi nộp)'
          errors={savedSubmitIssues}
        />
      )}

      {isOwner ? (
        <>
          <ConfirmDialog
            open={confirmAction !== null}
            onOpenChange={(open) => {
              if (!open && !busy) setConfirmAction(null);
            }}
            title={
              confirmAction === ADMIN_MODAL_ACTION.SUBMIT
                ? `${isReturned ? 'Nộp lại hồ sơ' : 'Nộp hồ sơ'}: ${product.name}`
                : `Xóa bản nháp: ${product.name}`
            }
            description={
              confirmAction === ADMIN_MODAL_ACTION.SUBMIT
                ? savedSubmitIssues.length > 0
                  ? 'Hồ sơ hiện chưa đủ các trường bắt buộc đã lưu. Hãy mở trang chỉnh sửa để bổ sung và lưu lại trước khi nộp.'
                  : 'Sau khi nộp, hồ sơ được chuyển tới Chủ trì / Quản trị xét duyệt trước khi phân công chấm điểm.'
                : 'Bản nháp sẽ bị xóa vĩnh viễn và không thể khôi phục.'
            }
            confirmLabel={
              confirmAction === ADMIN_MODAL_ACTION.SUBMIT
                ? isReturned
                  ? 'Nộp lại hồ sơ'
                  : 'Nộp hồ sơ'
                : 'Xóa bản nháp'
            }
            destructive={confirmAction === ADMIN_MODAL_ACTION.DELETE}
            pending={busy}
            confirmDisabled={
              confirmAction === ADMIN_MODAL_ACTION.SUBMIT && savedSubmitIssues.length > 0
            }
            error={
              confirmAction === ADMIN_MODAL_ACTION.SUBMIT && savedSubmitIssues.length > 0
                ? savedSubmitIssues
                : error
            }
            onConfirm={() => {
              if (confirmAction === ADMIN_MODAL_ACTION.SUBMIT) void submitOwner();
              else if (confirmAction === ADMIN_MODAL_ACTION.DELETE) void removeOwner();
            }}
          />

          <ConfirmDialog
            open={removingAttachment !== null}
            onOpenChange={(open) => {
              if (!open && !busy) setRemovingAttachment(null);
            }}
            title={`Xóa tệp đính kèm: ${removingAttachment?.fileName ?? ''}`}
            description='Tệp sẽ bị xóa khỏi hồ sơ sản phẩm.'
            confirmLabel='Xóa tệp'
            destructive
            pending={busy}
            onConfirm={() => {
              if (removingAttachment) void removeOwnerAttachment(removingAttachment.id);
            }}
          />
        </>
      ) : (
        <>
          <Dialog
            open={confirmAction !== null}
            onOpenChange={(open) => {
              if (!open) requestCloseDialog();
            }}
          >
            <DialogContent className='admin-dialog' data-admin-ui='true'>
              <DialogHeader>
                <DialogTitle>
                  {confirmAction === ADMIN_MODAL_ACTION.SUBMIT
                    ? `Nộp hồ sơ thay người đăng ký: ${product.name}`
                    : confirmAction === ADMIN_MODAL_ACTION.DELETE
                      ? `Xóa bản nháp: ${product.name}`
                      : confirmAction === ADMIN_MODAL_ACTION.APPROVE
                        ? `Duyệt hồ sơ sản phẩm: ${product.name}`
                        : confirmAction === ADMIN_MODAL_ACTION.RETURN
                          ? `Trả lại hồ sơ sản phẩm: ${product.name}`
                          : confirmAction === ADMIN_MODAL_ACTION.PUBLISH
                            ? `Công bố kết quả chấm điểm: ${product.name}`
                            : `Mở lại hồ sơ đã hoàn tất: ${product.name}`}
                </DialogTitle>
                <DialogDescription>
                  {confirmAction === ADMIN_MODAL_ACTION.SUBMIT
                    ? 'Sau khi nộp, hồ sơ được chốt thông tin đăng ký để chuyển sang bước xét duyệt.'
                    : confirmAction === ADMIN_MODAL_ACTION.DELETE
                      ? 'Bản nháp sẽ bị xóa khỏi danh sách hồ sơ. Thao tác này yêu cầu ghi nhận lý do.'
                      : confirmAction === ADMIN_MODAL_ACTION.APPROVE
                        ? 'Sau khi duyệt, hệ thống tự động phân công tất cả giám khảo đang hoạt động thuộc các cơ quan quản lý của phân loại sản phẩm này.'
                        : confirmAction === ADMIN_MODAL_ACTION.RETURN
                          ? 'Hồ sơ sẽ chuyển về trạng thái Bị trả lại kèm lý do để người đăng ký chỉnh sửa và nộp lại.'
                          : confirmAction === ADMIN_MODAL_ACTION.PUBLISH
                            ? 'Sau khi công bố, người đăng ký và trang tra cứu công khai sẽ xem được điểm tổng hợp và mức sao của hồ sơ.'
                            : 'Hồ sơ sẽ chuyển từ Hoàn tất về Đang chấm để Chủ trì / Quản trị có thể bổ sung giám khảo hoặc chờ phiếu chấm mới.'}
                </DialogDescription>
              </DialogHeader>
              <div className='admin-form'>
                <FormField
                  label={
                    confirmAction === ADMIN_MODAL_ACTION.RETURN
                      ? 'Lý do trả lại hồ sơ'
                      : confirmAction === ADMIN_MODAL_ACTION.REOPEN
                        ? 'Lý do mở lại hồ sơ'
                        : confirmAction === ADMIN_MODAL_ACTION.APPROVE ||
                            confirmAction === ADMIN_MODAL_ACTION.PUBLISH
                          ? 'Ghi chú (tùy chọn)'
                          : 'Lý do thao tác'
                  }
                  htmlFor='admin-product-action-reason'
                  required={
                    confirmAction === ADMIN_MODAL_ACTION.RETURN ||
                    confirmAction === ADMIN_MODAL_ACTION.REOPEN ||
                    confirmAction === ADMIN_MODAL_ACTION.SUBMIT ||
                    confirmAction === ADMIN_MODAL_ACTION.DELETE
                  }
                >
                  {confirmAction === ADMIN_MODAL_ACTION.RETURN ? (
                    <Textarea
                      id='admin-product-action-reason'
                      rows={3}
                      value={reason}
                      maxLength={1000}
                      disabled={busy}
                      placeholder='Nhập rõ nội dung cần người đăng ký bổ sung hoặc chỉnh sửa…'
                      onChange={(event) => setReason(event.target.value)}
                      required
                    />
                  ) : (
                    <Input
                      id='admin-product-action-reason'
                      value={reason}
                      maxLength={255}
                      disabled={busy}
                      placeholder='Nhập lý do hoặc ghi chú…'
                      onChange={(event) => setReason(event.target.value)}
                    />
                  )}
                </FormField>
                {(confirmAction === ADMIN_MODAL_ACTION.SUBMIT && savedSubmitIssues.length > 0) ||
                error ? (
                  <AlertError
                    title='Không thể thực hiện thao tác'
                    errors={
                      confirmAction === ADMIN_MODAL_ACTION.SUBMIT && savedSubmitIssues.length > 0
                        ? savedSubmitIssues
                        : [error]
                    }
                  />
                ) : null}
                <div className='admin-actions'>
                  {confirmAction === ADMIN_MODAL_ACTION.SUBMIT && (
                    <Button
                      type='button'
                      loading={busy}
                      disabled={busy || !reason.trim() || savedSubmitIssues.length > 0}
                      onClick={() =>
                        void runAdmin((confirmedReason) => actions.submit(confirmedReason), {
                          successText: 'Đã nộp hồ sơ thay người đăng ký.',
                        })
                      }
                    >
                      {busy ? 'Đang nộp…' : 'Nộp hồ sơ thay người đăng ký'}
                    </Button>
                  )}
                  {confirmAction === ADMIN_MODAL_ACTION.DELETE && (
                    <Button
                      type='button'
                      variant='destructive'
                      loading={busy}
                      disabled={busy || !reason.trim()}
                      onClick={() =>
                        void runAdmin((confirmedReason) => actions.remove(confirmedReason), {
                          returnToList: true,
                        })
                      }
                    >
                      {busy ? 'Đang xóa…' : 'Xác nhận xóa bản nháp'}
                    </Button>
                  )}
                  {confirmAction === ADMIN_MODAL_ACTION.APPROVE && (
                    <Button
                      type='button'
                      variant='primary'
                      loading={busy}
                      disabled={busy}
                      onClick={() =>
                        void runAdmin(
                          (confirmedReason) => actions.approve(confirmedReason || undefined),
                          {
                            requireReason: false,
                            successText:
                              'Đã duyệt hồ sơ và tự động phân công giám khảo theo cơ quan quản lý.',
                          },
                        )
                      }
                    >
                      {busy ? 'Đang duyệt…' : 'Xác nhận duyệt hồ sơ'}
                    </Button>
                  )}
                  {confirmAction === ADMIN_MODAL_ACTION.RETURN && (
                    <Button
                      type='button'
                      variant='destructive'
                      loading={busy}
                      disabled={busy || !reason.trim()}
                      onClick={() =>
                        void runAdmin((confirmedReason) => actions.returnProduct(confirmedReason), {
                          successText: 'Đã trả lại hồ sơ cho người đăng ký.',
                        })
                      }
                    >
                      {busy ? 'Đang trả lại…' : 'Xác nhận trả lại hồ sơ'}
                    </Button>
                  )}
                  {confirmAction === ADMIN_MODAL_ACTION.PUBLISH && (
                    <Button
                      type='button'
                      variant='primary'
                      loading={busy}
                      disabled={busy}
                      onClick={() =>
                        void runAdmin(
                          (confirmedReason) => actions.publishResults(confirmedReason || undefined),
                          {
                            requireReason: false,
                            successText: 'Đã công bố kết quả chấm điểm cho người đăng ký.',
                          },
                        )
                      }
                    >
                      {busy ? 'Đang công bố…' : 'Xác nhận công bố kết quả'}
                    </Button>
                  )}
                  {confirmAction === ADMIN_MODAL_ACTION.REOPEN && (
                    <Button
                      type='button'
                      loading={busy}
                      disabled={busy || !reason.trim()}
                      onClick={() =>
                        void runAdmin((confirmedReason) => actions.reopen(confirmedReason), {
                          successText: 'Đã mở lại hồ sơ để tiếp tục phân công/chấm điểm.',
                        })
                      }
                    >
                      {busy ? 'Đang mở lại…' : 'Xác nhận mở lại hồ sơ'}
                    </Button>
                  )}
                  <Button
                    type='button'
                    variant='secondary'
                    disabled={busy}
                    onClick={requestCloseDialog}
                  >
                    Đóng
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={restoreConfirmPrompt !== null}
            onOpenChange={(open) => {
              if (!open && !busy) setRestoreConfirmPrompt(null);
            }}
          >
            <DialogContent className='admin-dialog' data-admin-ui='true'>
              <DialogHeader>
                <DialogTitle>Xác nhận khôi phục phiếu chấm cũ của giám khảo</DialogTitle>
                <DialogDescription>
                  Giám khảo này từng chấm hồ sơ trước khi bị gỡ. Nếu giao lại cho cùng giám khảo, hệ
                  thống sẽ khôi phục toàn bộ điểm, ghi chú và trạng thái nộp cũ của phiếu chấm đó.
                </DialogDescription>
              </DialogHeader>
              {restoreConfirmPrompt && (
                <div className='admin-form space-y-3 text-sm'>
                  <dl className='detail-facts'>
                    <div>
                      <dt>Trạng thái phiếu trước khi gỡ</dt>
                      <dd>
                        {restoreConfirmPrompt.previousEvaluation.previousStatus ===
                        EVALUATION_STATUS.SUBMITTED
                          ? 'Đã nộp phiếu chấm'
                          : 'Đang chấm nháp'}
                      </dd>
                    </div>
                    <div>
                      <dt>Tổng điểm đã chấm</dt>
                      <dd>
                        {restoreConfirmPrompt.previousEvaluation.total !== null
                          ? `${restoreConfirmPrompt.previousEvaluation.total} điểm`
                          : `${restoreConfirmPrompt.previousEvaluation.scoreCount} tiêu chí thành phần đã lưu`}
                      </dd>
                    </div>
                  </dl>
                  <div className='admin-actions'>
                    <Button
                      type='button'
                      variant='primary'
                      loading={busy}
                      disabled={busy}
                      onClick={() => void handleAddJudge(true)}
                    >
                      Xác nhận giao lại &amp; khôi phục phiếu cũ
                    </Button>
                    <Button
                      type='button'
                      variant='secondary'
                      disabled={busy}
                      onClick={() => setRestoreConfirmPrompt(null)}
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog
            open={removingAttachment !== null}
            onOpenChange={(open) => {
              if (!open) requestCloseDialog();
            }}
          >
            <DialogContent className='admin-dialog' data-admin-ui='true'>
              <DialogHeader>
                <DialogTitle>
                  Xóa tệp đính kèm: {removingAttachment?.fileName ?? ''} ({product.name})
                </DialogTitle>
                <DialogDescription>
                  Nhập lý do xóa tệp khỏi bản nháp hồ sơ sản phẩm.
                </DialogDescription>
              </DialogHeader>
              <div className='admin-form'>
                <FormField label='Lý do xóa tệp' htmlFor='admin-attachment-remove-reason'>
                  <Input
                    id='admin-attachment-remove-reason'
                    value={reason}
                    maxLength={255}
                    disabled={busy}
                    onChange={(event) => setReason(event.target.value)}
                    required
                  />
                </FormField>
                {error && <AlertError title='Không thể xóa tệp' errors={[error]} />}
                <div className='admin-actions'>
                  <Button
                    type='button'
                    variant='destructive'
                    loading={busy}
                    disabled={busy || !reason.trim() || !removingAttachment}
                    onClick={() =>
                      removingAttachment &&
                      void runAdmin(
                        (confirmedReason) =>
                          actions.removeAttachment(removingAttachment.id, confirmedReason),
                        {
                          successText: 'Đã xóa tệp đính kèm.',
                        },
                      )
                    }
                  >
                    {busy ? 'Đang xóa tệp…' : 'Xác nhận xóa tệp'}
                  </Button>
                  <Button
                    type='button'
                    variant='secondary'
                    disabled={busy}
                    onClick={requestCloseDialog}
                  >
                    Đóng
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      <Tabs value={selectedTab} onValueChange={changeDetailTab}>
        <TabsList aria-label='Nội dung hồ sơ'>
          <TabsTrigger value={ADMIN_PRODUCT_DETAIL_TAB.INFORMATION}>Thông tin</TabsTrigger>
          <TabsTrigger value={ADMIN_PRODUCT_DETAIL_TAB.REGISTRATION}>Phiếu đăng ký</TabsTrigger>
          <TabsTrigger value={ADMIN_PRODUCT_DETAIL_TAB.FILES}>Tệp</TabsTrigger>
          <TabsTrigger value={ADMIN_PRODUCT_DETAIL_TAB.PROGRESS}>Tiến độ</TabsTrigger>
          <TabsTrigger value={ADMIN_PRODUCT_DETAIL_TAB.RESULTS}>Kết quả</TabsTrigger>
        </TabsList>

        <TabsContent value={ADMIN_PRODUCT_DETAIL_TAB.INFORMATION}>
          <PageSection>
            <dl className='detail-facts'>
              <div>
                <dt>Mã hồ sơ</dt>
                <dd className='font-mono text-xs'>{displayProductCode(product)}</dd>
              </div>
              <div>
                <dt>Người đăng ký</dt>
                <dd>
                  {registrantName}
                  {registrantEmail ? ` · ${registrantEmail}` : ''} ·{' '}
                  {registrantPhone ?? 'Chưa có điện thoại'}
                </dd>
              </div>
              {adminProduct && (
                <div>
                  <dt>Người tạo hồ sơ</dt>
                  <dd>{adminProduct.createdBy?.fullName ?? 'Người đăng ký tự nhập'}</dd>
                </div>
              )}
              <div>
                <dt>Danh mục sản phẩm</dt>
                <dd>{product.category.name}</dd>
              </div>
              {adminProduct?.category.managingAgencies &&
                adminProduct.category.managingAgencies.length > 0 && (
                  <div>
                    <dt>Cơ quan chủ trì quản lý</dt>
                    <dd>
                      {adminProduct.category.managingAgencies
                        .map((a) => `${a.name} (${a.code})`)
                        .join(' · ')}
                    </dd>
                  </div>
                )}
              <div>
                <dt>Địa bàn hành chính</dt>
                <dd>
                  {product.locality
                    ? `${product.locality.name} · ${product.locality.provinceName}`
                    : 'Chưa gắn địa bàn'}
                </dd>
              </div>
              <div>
                <dt>Trạng thái hồ sơ</dt>
                <dd>{formatStatusLabel(product.status, isOwner)}</dd>
              </div>
              <div>
                <dt>Ngày nộp</dt>
                <dd>
                  {product.submittedAt
                    ? new Date(product.submittedAt).toLocaleString('vi-VN')
                    : 'Chưa nộp'}
                </dd>
              </div>
              {adminProduct?.approvedAt && (
                <div>
                  <dt>Thời điểm duyệt hồ sơ</dt>
                  <dd>
                    {new Date(adminProduct.approvedAt).toLocaleString('vi-VN')}
                    {adminProduct.approvedBy ? ` · bởi ${adminProduct.approvedBy.fullName}` : ''}
                  </dd>
                </div>
              )}
              <div>
                <dt>Trạng thái công bố kết quả</dt>
                <dd>
                  {isPublished
                    ? `Đã công bố${product.publishedAt ? ` (${new Date(product.publishedAt).toLocaleString('vi-VN')})` : ''}`
                    : isUpdatingResult
                      ? 'Đang cập nhật kết quả (chờ công bố lại)'
                      : 'Chưa công bố'}
                </dd>
              </div>
              <div>
                <dt>Kết quả đánh giá</dt>
                <dd>
                  {resultReady
                    ? `${formatExactScore(product.finalScore)} điểm · ${formatStarRatingLabel(product.starRating)}`
                    : isOwner && isUpdatingResult
                      ? 'Kết quả đang được cập nhật sau khi có phiếu chấm bổ sung'
                      : isOwner && isCompleted
                        ? 'Đã hoàn tất chấm điểm — đang chờ Chủ trì/Quản trị công bố kết quả'
                        : 'Chưa có kết quả'}
                </dd>
              </div>
            </dl>
            {product.description && (
              <div className='border-border mt-4 border-t pt-4'>
                <h2 className='mb-1 text-base font-semibold'>Mô tả sản phẩm</h2>
                <p className='text-fg text-sm'>{product.description}</p>
              </div>
            )}
          </PageSection>
        </TabsContent>

        <TabsContent value={ADMIN_PRODUCT_DETAIL_TAB.REGISTRATION}>
          <PageSection>
            {product.registrationSnapshot ? (
              <>
                <div className='mb-4'>
                  <h2>Thông tin lưu tại thời điểm nộp</h2>
                  <p className='text-muted text-sm'>
                    Thời điểm chốt hồ sơ:{' '}
                    {new Date(product.registrationSnapshot.submittedAt).toLocaleString('vi-VN')}{' '}
                    (chỉ đọc).
                  </p>
                </div>
                <dl className='detail-facts'>
                  {formatFormEntries(
                    product.registrationSnapshot.formData as unknown as Record<string, unknown>,
                  ).map((entry) => (
                    <div key={entry.key}>
                      <dt>{entry.label}</dt>
                      <dd>{entry.value}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>Địa bàn tại thời điểm nộp</dt>
                    <dd>
                      {product.registrationSnapshot.locality.name} ·{' '}
                      {product.registrationSnapshot.locality.provinceName}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <div className='mb-4'>
                  <h2>
                    {isDraft
                      ? 'Thông tin bản nháp phiếu đăng ký hiện tại'
                      : 'Thông tin phiếu đăng ký hiện tại'}
                  </h2>
                  <p className='text-muted text-sm' role='status'>
                    {isDraft
                      ? 'Hồ sơ đang ở trạng thái Bản nháp, chưa có bản chụp tại thời điểm nộp.'
                      : 'Hồ sơ này chưa có bản chụp tại thời điểm nộp; đang hiển thị dữ liệu khai báo hiện lưu trên hồ sơ.'}
                  </p>
                </div>
                <dl className='detail-facts'>
                  {formEntries.map((entry) => (
                    <div key={entry.key}>
                      <dt>{entry.label}</dt>
                      <dd>{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </PageSection>
        </TabsContent>

        <TabsContent value={ADMIN_PRODUCT_DETAIL_TAB.FILES}>
          <PageSection className='attachment-dossier-section'>
            <div className='attachment-dossier-header'>
              <div className='attachment-dossier-title-group'>
                <h2>Tệp minh chứng và hình ảnh</h2>
                <p className='attachment-dossier-subtitle'>
                  Tập hợp hình ảnh nhận diện sản phẩm và tài liệu pháp lý, chứng nhận chất lượng
                  phục vụ hội đồng đánh giá.
                </p>
              </div>
              <div className='attachment-dossier-stats' aria-label='Thống kê tệp đính kèm'>
                <span className='attachment-stat-pill is-accent'>
                  <ImageIcon className='size-4 shrink-0' aria-hidden='true' />
                  <span>{imageAttachments.length} hình ảnh</span>
                </span>
                <span className='attachment-stat-pill'>
                  <FileText className='size-4 shrink-0' aria-hidden='true' />
                  <span>{documentAttachments.length} tài liệu</span>
                </span>
                <span className='attachment-stat-pill is-mono'>
                  <span>
                    {product.attachments.length} / {MAX_PRODUCT_ATTACHMENTS} tệp
                  </span>
                </span>
              </div>
            </div>

            {product.attachments.length ? (
              <div className='attachment-dossier-body'>
                {imageAttachments.length > 0 && (
                  <section
                    className='attachment-subsection'
                    aria-label='Bộ sưu tập hình ảnh sản phẩm'
                  >
                    <div className='attachment-subsection-head'>
                      <div className='attachment-subsection-title'>
                        <ImageIcon className='text-accent size-4' aria-hidden='true' />
                        <h3>Hình ảnh nhận diện &amp; bao bì sản phẩm</h3>
                      </div>
                      <span className='attachment-subsection-meta'>
                        Nhấn vào khung ảnh để phóng to hoặc nhấn tên tệp để mở bản gốc
                      </span>
                    </div>

                    <div
                      className={
                        imageAttachments.length === 1
                          ? 'attachment-gallery-grid is-single'
                          : 'attachment-gallery-grid'
                      }
                    >
                      {imageAttachments.map((file, index) => {
                        const dims = imageDimensions[file.id];
                        const ext = getFileExtension(file.fileName);
                        const indexBadge = `ẢNH #${String(index + 1).padStart(2, '0')}`;
                        return (
                          <article
                            className={
                              imageAttachments.length === 1
                                ? 'attachment-image-card is-featured'
                                : 'attachment-image-card'
                            }
                            key={file.id}
                          >
                            <button
                              type='button'
                              className='attachment-image-stage'
                              onClick={() => setPreviewImageIndex(index)}
                              aria-label={`Phóng to hình ảnh ${file.fileName}`}
                            >
                              <span className='attachment-stage-badge'>{indexBadge}</span>
                              <div className='attachment-stage-canvas'>
                                <PrivateAttachmentThumbnail
                                  mode={attachmentMode}
                                  productId={product.id}
                                  attachmentId={file.id}
                                  name={file.fileName}
                                  onImageLoad={({ width, height }) =>
                                    setImageDimensions((prev) =>
                                      prev[file.id]?.width === width &&
                                      prev[file.id]?.height === height
                                        ? prev
                                        : { ...prev, [file.id]: { width, height } },
                                    )
                                  }
                                />
                              </div>
                              <span className='attachment-stage-zoom' aria-hidden='true'>
                                <Maximize2 className='size-3.5' />
                                <span>Phóng to</span>
                              </span>
                            </button>

                            <div className='attachment-image-body'>
                              <div className='attachment-image-meta-top'>
                                <span className='attachment-ext-tag'>{ext}</span>
                                <span className='attachment-type-label'>
                                  {formatAttachmentType(file.type)}
                                </span>
                                {dims && (
                                  <span className='attachment-dims-label'>
                                    {dims.width} × {dims.height} px
                                  </span>
                                )}
                              </div>

                              <div className='attachment-image-title-wrap'>
                                <AttachmentLink
                                  mode={attachmentMode}
                                  productId={product.id}
                                  attachmentId={file.id}
                                  name={file.fileName}
                                  className='attachment-filename-link'
                                />
                              </div>

                              {imageAttachments.length === 1 && (
                                <p className='attachment-image-caption'>
                                  Hình ảnh đại diện chính thức của hồ sơ{' '}
                                  <strong>{product.name}</strong> dùng để đối chiếu nhãn hàng hóa,
                                  bao bì và truy xuất nguồn gốc khi chấm điểm.
                                </p>
                              )}

                              <div className='attachment-image-actions'>
                                <Button
                                  type='button'
                                  variant='secondary'
                                  size='sm'
                                  onClick={() => setPreviewImageIndex(index)}
                                >
                                  <Maximize2 className='size-3.5' aria-hidden='true' />
                                  <span>Xem ảnh lớn</span>
                                </Button>
                                {(isOwner || canManage) && isEditable && (
                                  <Button
                                    type='button'
                                    variant='secondary'
                                    size='sm'
                                    disabled={busy}
                                    onClick={() => {
                                      setError('');
                                      setRemovingAttachment({
                                        id: file.id,
                                        fileName: file.fileName,
                                      });
                                    }}
                                  >
                                    <Trash2 className='size-3.5' aria-hidden='true' />
                                    <span>Xóa tệp</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}

                {documentAttachments.length > 0 && (
                  <section
                    className='attachment-subsection'
                    aria-label='Danh sách tài liệu minh chứng'
                  >
                    <div className='attachment-subsection-head'>
                      <div className='attachment-subsection-title'>
                        <FileText className='text-accent size-4' aria-hidden='true' />
                        <h3>Tài liệu minh chứng &amp; hồ sơ pháp lý</h3>
                      </div>
                      <span className='attachment-subsection-meta'>
                        {documentAttachments.length} tài liệu đính kèm
                      </span>
                    </div>

                    <ul className='attachment-doc-list'>
                      {documentAttachments.map((file, index) => {
                        const ext = getFileExtension(file.fileName);
                        return (
                          <li className='attachment-doc-row' key={file.id}>
                            <div className='attachment-doc-emblem' aria-hidden='true'>
                              <FileText className='size-4' />
                              <span>{ext}</span>
                            </div>
                            <div className='attachment-doc-main'>
                              <AttachmentLink
                                mode={attachmentMode}
                                productId={product.id}
                                attachmentId={file.id}
                                name={file.fileName}
                                className='attachment-filename-link'
                              />
                              <p className='attachment-doc-sub'>
                                Tài liệu #{String(index + 1).padStart(2, '0')} ·{' '}
                                {formatAttachmentType(file.type)}
                              </p>
                            </div>
                            <div className='attachment-doc-actions'>
                              <Button
                                type='button'
                                variant='secondary'
                                size='sm'
                                onClick={() =>
                                  void openProductAttachmentByMode(
                                    attachmentMode,
                                    product.id,
                                    file.id,
                                    file.fileName,
                                  )
                                }
                              >
                                <ExternalLink className='size-3.5' aria-hidden='true' />
                                <span>Mở tài liệu</span>
                              </Button>
                              {(isOwner || canManage) && isEditable && (
                                <Button
                                  type='button'
                                  variant='secondary'
                                  size='sm'
                                  disabled={busy}
                                  onClick={() => {
                                    setError('');
                                    setRemovingAttachment({
                                      id: file.id,
                                      fileName: file.fileName,
                                    });
                                  }}
                                >
                                  <Trash2 className='size-3.5' aria-hidden='true' />
                                  <span>Xóa tệp</span>
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
              </div>
            ) : (
              <div className='attachment-empty-state'>
                <ImageIcon className='text-muted size-8' aria-hidden='true' />
                <h3>Hồ sơ chưa có tệp đính kèm</h3>
                <p className='text-muted text-sm'>
                  Chưa có hình ảnh sản phẩm hoặc tài liệu minh chứng nào được tải lên cho hồ sơ này.
                </p>
              </div>
            )}
          </PageSection>

          <ImagePreviewDialog
            items={imageAttachments.map((file) => ({
              kind: 'private',
              id: file.id,
              name: file.fileName,
              mode: attachmentMode,
              productId: product.id,
            }))}
            activeIndex={previewImageIndex}
            onIndexChange={setPreviewImageIndex}
            contextLabel={`Hồ sơ: ${product.name}`}
          />
        </TabsContent>

        <TabsContent value={ADMIN_PRODUCT_DETAIL_TAB.PROGRESS}>
          <div className='space-y-4'>
            {!isOwner && adminProduct && (
              <PageSection>
                <div className='admin-page-heading mb-3'>
                  <div>
                    <h2>Phân công giám khảo theo cơ quan quản lý</h2>
                    <p className='text-muted text-sm'>
                      Khi duyệt hồ sơ, hệ thống tự động phân công tất cả giám khảo đang hoạt động
                      thuộc các cơ quan quản lý của phân loại sản phẩm. Mỗi giám khảo chấm toàn bộ
                      tiêu chí trên phiếu riêng.
                    </p>
                  </div>
                </div>

                {adminProduct.agencyCoverage && adminProduct.agencyCoverage.length > 0 && (
                  <div className='mb-4 grid gap-3 sm:grid-cols-2'>
                    {adminProduct.agencyCoverage.map((cov) => (
                      <div key={cov.agency.id} className='rounded-lg border p-3 text-sm'>
                        <div className='flex items-center justify-between gap-2'>
                          <strong>
                            {cov.agency.name} ({cov.agency.code})
                          </strong>
                          {cov.hasMissingJudges ? (
                            <Badge variant='destructive'>Thiếu giám khảo</Badge>
                          ) : (
                            <Badge variant='secondary'>
                              <CheckCircle2 className='mr-1 size-3.5' aria-hidden='true' />
                              {cov.activeJudgeCount} giám khảo
                            </Badge>
                          )}
                        </div>
                        <p className='text-muted mt-1 text-xs'>
                          Đã nộp phiếu: {cov.submittedCount} / {cov.activeJudgeCount} giám khảo
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {canView && isScoringOrApproved && (
                  <div className='mb-4 rounded-lg border p-4'>
                    <h3 className='mb-2 text-sm font-semibold'>
                      Bổ sung thủ công giám khảo thuộc cơ quan tương ứng
                    </h3>
                    <div className='admin-filters'>
                      <FormField
                        label='Chọn giám khảo'
                        htmlFor='product-add-judge-select'
                        className='admin-filter-field'
                        data-filter-width='group'
                      >
                        <Combobox
                          value={selectedAddJudgeId || ALL}
                          onValueChange={(value) =>
                            setSelectedAddJudgeId(value === ALL ? '' : value)
                          }
                        >
                          <ComboboxAnchor>
                            <ComboboxInput
                              id='product-add-judge-select'
                              placeholder='Chọn giám khảo thuộc cơ quan quản lý…'
                            />
                            <ComboboxTrigger />
                          </ComboboxAnchor>
                          <ComboboxContent>
                            <ComboboxEmpty>
                              Không còn giám khảo hợp lệ thuộc cơ quan quản lý này.
                            </ComboboxEmpty>
                            <ComboboxItem value={ALL}>Chọn giám khảo</ComboboxItem>
                            {eligibleManualJudges.map((judge) => (
                              <ComboboxItem key={judge.id} value={judge.id}>
                                {judge.fullName} ({judge.email})
                                {judge.organizationUnit ? ` · ${judge.organizationUnit.name}` : ''}
                              </ComboboxItem>
                            ))}
                          </ComboboxContent>
                        </Combobox>
                      </FormField>
                      <FormField
                        label='Lý do bổ sung (tùy chọn)'
                        htmlFor='product-add-judge-reason'
                        className='admin-filter-field'
                        data-filter-width='search'
                      >
                        <Input
                          id='product-add-judge-reason'
                          value={addJudgeReason}
                          maxLength={255}
                          placeholder='Ghi chú lý do bổ sung giám khảo…'
                          onChange={(event) => setAddJudgeReason(event.target.value)}
                        />
                      </FormField>
                      <div className='admin-actions admin-filter-actions'>
                        <Button
                          type='button'
                          disabled={busy || !selectedAddJudgeId}
                          onClick={() => void handleAddJudge(false)}
                        >
                          <UserPlus className='size-4' aria-hidden='true' />
                          <span>Bổ sung giám khảo</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {adminProduct.judgeAssignments && adminProduct.judgeAssignments.length > 0 ? (
                  <div className='record-list'>
                    {adminProduct.judgeAssignments.map((assignment) => (
                      <div className='record-row' key={assignment.id}>
                        <div className='record-main'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <strong>{assignment.judge.fullName}</strong>
                            <Badge variant={assignment.isActive ? 'secondary' : 'outline'}>
                              {assignment.isActive ? 'Đang phân công' : 'Đã gỡ khỏi hồ sơ'}
                            </Badge>
                            {assignment.isManual && (
                              <Badge variant='outline'>Bổ sung thủ công</Badge>
                            )}
                            {assignment.mustSubmitToComplete && assignment.isActive && (
                              <Badge variant='outline'>Chờ nộp trước khi hoàn tất</Badge>
                            )}
                            {assignment.evaluation && (
                              <Badge
                                variant='outline'
                                className={
                                  assignment.evaluation.status === EVALUATION_STATUS.SUBMITTED
                                    ? 'status-badge status-completed'
                                    : assignment.evaluation.status === EVALUATION_STATUS.EXCLUDED
                                      ? 'status-badge status-draft'
                                      : 'status-badge status-scoring'
                                }
                              >
                                {assignment.evaluation.status === EVALUATION_STATUS.SUBMITTED
                                  ? `Đã nộp (${assignment.evaluation.total ?? 0} điểm)`
                                  : assignment.evaluation.status === EVALUATION_STATUS.EXCLUDED
                                    ? 'Phiếu bị loại (lịch sử)'
                                    : 'Đang chấm nháp'}
                              </Badge>
                            )}
                          </div>
                          <p className='text-muted mt-1 text-xs'>
                            {assignment.judge.email}
                            {assignment.organizationUnitName
                              ? ` · Đơn vị: ${assignment.organizationUnitName}`
                              : ''}
                            {assignment.managingAgency
                              ? ` · Cơ quan: ${assignment.managingAgency.name}`
                              : ''}
                            {assignment.removeReason
                              ? ` · Lý do gỡ: ${assignment.removeReason}`
                              : ''}
                          </p>
                        </div>
                        <div className='admin-actions'>
                          {canView &&
                            assignment.evaluation?.status === EVALUATION_STATUS.SUBMITTED &&
                            assignment.isActive && (
                              <Button
                                type='button'
                                variant='secondary'
                                size='sm'
                                disabled={busy}
                                onClick={() => {
                                  const r = window.prompt(
                                    `Nhập lý do mở lại phiếu chấm của ${assignment.judge.fullName}:`,
                                    'Mở lại phiếu nộp nhầm để giám khảo chỉnh sửa',
                                  );
                                  if (r !== null && assignment.evaluation) {
                                    void actions.reopenEvaluation(
                                      assignment.evaluation.id,
                                      r.trim() || undefined,
                                    );
                                  }
                                }}
                              >
                                Mở lại phiếu
                              </Button>
                            )}
                          {canView && assignment.isActive && (
                            <Button
                              type='button'
                              variant='destructive'
                              size='sm'
                              disabled={busy}
                              onClick={() => {
                                const r = window.prompt(
                                  `Nhập lý do gỡ giám khảo ${assignment.judge.fullName} khỏi hồ sơ:`,
                                  'Điều chỉnh phân công giám khảo',
                                );
                                if (r !== null) {
                                  void actions.removeAssignment(
                                    assignment.judgeId,
                                    r.trim() || undefined,
                                  );
                                }
                              }}
                            >
                              Gỡ giám khảo
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='text-muted text-sm'>
                    {isSubmitted
                      ? 'Hồ sơ đang chờ duyệt. Sau khi duyệt, giám khảo thuộc cơ quan quản lý sẽ được tự động phân công.'
                      : 'Chưa có giám khảo nào được phân công cho hồ sơ này.'}
                  </p>
                )}
              </PageSection>
            )}

            <PageSection>
              <h2 className='mb-3'>Lịch sử trạng thái hồ sơ</h2>
              {adminProduct ? (
                adminProduct.statusEvents.length > 0 ? (
                  <ol className='record-list' style={{ paddingLeft: '20px', margin: 0 }}>
                    {adminProduct.statusEvents.map((event) => (
                      <li
                        className='border-border border-b py-2 last:border-b-0'
                        key={event.sequence}
                      >
                        <div>
                          <strong>{formatStatusLabel(event.fromStatus)}</strong> →{' '}
                          <strong>{formatStatusLabel(event.toStatus)}</strong>
                        </div>
                        <div className='text-muted mt-0.5 text-xs'>
                          {new Date(event.createdAt).toLocaleString('vi-VN')}
                          {event.actor ? ` · Người thực hiện: ${event.actor.fullName}` : ''}
                          {event.reason ? ` · Lý do: ${event.reason}` : ''}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className='text-muted text-sm'>Chưa có sự kiện thay đổi trạng thái nào.</p>
                )
              ) : (
                <dl className='detail-facts'>
                  <div>
                    <dt>Trạng thái hiện tại</dt>
                    <dd>{formatStatusLabel(product.status, true)}</dd>
                  </div>
                  <div>
                    <dt>Thời điểm nộp hồ sơ</dt>
                    <dd>
                      {product.submittedAt
                        ? new Date(product.submittedAt).toLocaleString('vi-VN')
                        : 'Chưa nộp'}
                    </dd>
                  </div>
                  <div>
                    <dt>Thời điểm hoàn tất đánh giá</dt>
                    <dd>
                      {ownerProduct?.completedAt
                        ? new Date(ownerProduct.completedAt).toLocaleString('vi-VN')
                        : 'Chưa hoàn tất'}
                    </dd>
                  </div>
                  <div>
                    <dt>Cập nhật gần nhất</dt>
                    <dd>
                      {ownerProduct?.updatedAt
                        ? new Date(ownerProduct.updatedAt).toLocaleString('vi-VN')
                        : 'Chưa cập nhật'}
                    </dd>
                  </div>
                </dl>
              )}
            </PageSection>

            {!isOwner && adminProduct?.resultHistory && adminProduct.resultHistory.length > 0 && (
              <PageSection>
                <h2 className='mb-3'>Lịch sử cập nhật &amp; công bố kết quả</h2>
                <ol className='record-list' style={{ paddingLeft: '20px', margin: 0 }}>
                  {adminProduct.resultHistory.map((item) => (
                    <li className='border-border border-b py-2 last:border-b-0' key={item.id}>
                      <div>
                        <strong>{item.action}</strong>:{' '}
                        {item.finalScore !== null
                          ? `${formatExactScore(item.finalScore)} điểm · ${formatStarRatingLabel(item.starRating)}`
                          : 'Chưa chốt điểm'}
                      </div>
                      <div className='text-muted mt-0.5 text-xs'>
                        {new Date(item.createdAt).toLocaleString('vi-VN')}
                        {item.actor ? ` · bởi ${item.actor.fullName}` : ''}
                        {item.reason ? ` · Ghi chú: ${item.reason}` : ''}
                      </div>
                    </li>
                  ))}
                </ol>
              </PageSection>
            )}
          </div>
        </TabsContent>

        <TabsContent value={ADMIN_PRODUCT_DETAIL_TAB.RESULTS}>
          {isOwner ? (
            <PageSection>
              <h2 className='mb-3'>Kết quả đánh giá</h2>
              {resultReady ? (
                <div className='space-y-4'>
                  <dl className='detail-facts'>
                    <div>
                      <dt>Điểm tổng hợp</dt>
                      <dd className='font-semibold'>{formatExactScore(product.finalScore)} điểm</dd>
                    </div>
                    <div>
                      <dt>Phân hạng OCOP</dt>
                      <dd className='font-semibold'>{formatStarRatingLabel(product.starRating)}</dd>
                    </div>
                  </dl>
                  <div className='admin-actions'>
                    <Button asChild variant='secondary'>
                      <Link to='/print/products/$id/results' params={{ id: product.id }}>
                        In kết quả đánh giá
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className='text-muted text-sm' role='status'>
                  {isDraft
                    ? 'Hồ sơ chưa được nộp để đánh giá.'
                    : isReturned
                      ? `Hồ sơ bị trả lại: ${product.returnReason ?? 'Vui lòng chỉnh sửa và nộp lại.'}`
                      : isUpdatingResult
                        ? 'Kết quả đánh giá đang được cập nhật do có phiếu chấm bổ sung và chờ Chủ trì/Quản trị công bố lại.'
                        : isCompleted
                          ? 'Hồ sơ đã hoàn tất chấm điểm và đang chờ Chủ trì/Quản trị công bố kết quả.'
                          : 'Hồ sơ đang chờ hội đồng hoàn tất đánh giá. Kết quả sẽ hiển thị tại đây sau khi được công bố.'}
                </p>
              )}
            </PageSection>
          ) : (
            <AdminProductResultsPage
              productId={product.id}
              mode={adminMode}
              printSearch={printSearch}
            />
          )}
        </TabsContent>
      </Tabs>
      <Outlet />
    </PageContainer>
  );
}
