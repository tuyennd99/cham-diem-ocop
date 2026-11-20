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
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import AlertError from '@/components/alert-error';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  ATTACHMENT_TYPE,
  EVALUATION_STATUS,
  PRODUCT_PUBLICATION_STATE,
  PRODUCT_STATUS,
  PRODUCT_WORKSPACE_MODE,
  STAFF_PERMISSION,
} from '../../constants/consts';
import { PRODUCT_STATUS_TONE } from '../../constants/product-status';
import { queryKeys } from '../../constants/query-key';
import { formatDateTime } from '../../lib/admin-date';
import {
  toAdminProductApiQuery,
  type AdminProductDetailTab,
  type AdminProductSearch,
} from '../../lib/admin-search';
import { errorText, messageOf } from '../../lib/api-error';
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
  useAdminProductDetail,
  useAdminProductMutations,
  useProductEligibleJudges,
  type AdminProductMode,
} from '../../queries/admin-products';
import { useMyProduct } from '../../queries/registrant';
import type { RegistrantProduct } from '../../types/registrant';
import { AdminProductResultsPage } from './AdminProductResultsPage';
import { ProductFilesTab } from './product-detail/ProductFilesTab';
import { ProductInformationTab } from './product-detail/ProductInformationTab';
import { ProductProgressTab } from './product-detail/ProductProgressTab';
import { ProductRegistrationTab } from './product-detail/ProductRegistrationTab';
import { formatStatusLabel, type EligibleManualJudge } from './product-detail/shared';

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

type AdminModalAction = (typeof ADMIN_MODAL_ACTION)[keyof typeof ADMIN_MODAL_ACTION];
type AdminModalKind = AdminModalAction | null;

interface AdminModalDialogConfig {
  title: string;
  description: string;
  reasonLabel: string;
  requireReason: boolean;
  useTextarea?: boolean;
  variant?: 'primary' | 'destructive';
  confirmLabel: string;
  pendingLabel: string;
  successText?: string;
  returnToList?: boolean;
}

const ADMIN_MODAL_DIALOG_CONFIG: Record<AdminModalAction, AdminModalDialogConfig> = {
  [ADMIN_MODAL_ACTION.SUBMIT]: {
    title: 'Nộp hồ sơ thay người đăng ký',
    description: 'Sau khi nộp, hồ sơ được chốt thông tin đăng ký để chuyển sang bước xét duyệt.',
    reasonLabel: 'Lý do thao tác',
    requireReason: true,
    confirmLabel: 'Nộp hồ sơ thay người đăng ký',
    pendingLabel: 'Đang nộp…',
    successText: 'Đã nộp hồ sơ thay người đăng ký.',
  },
  [ADMIN_MODAL_ACTION.DELETE]: {
    title: 'Xóa bản nháp hồ sơ',
    description: 'Bản nháp sẽ bị xóa khỏi danh sách hồ sơ. Thao tác này yêu cầu ghi nhận lý do.',
    reasonLabel: 'Lý do thao tác',
    requireReason: true,
    variant: 'destructive',
    confirmLabel: 'Xác nhận xóa bản nháp',
    pendingLabel: 'Đang xóa…',
    returnToList: true,
  },
  [ADMIN_MODAL_ACTION.APPROVE]: {
    title: 'Duyệt hồ sơ sản phẩm',
    description:
      'Sau khi duyệt, hệ thống tự động phân công tất cả giám khảo đang hoạt động thuộc các cơ quan quản lý của phân loại sản phẩm này.',
    reasonLabel: 'Ghi chú (tùy chọn)',
    requireReason: false,
    variant: 'primary',
    confirmLabel: 'Xác nhận duyệt hồ sơ',
    pendingLabel: 'Đang duyệt…',
    successText: 'Đã duyệt hồ sơ và tự động phân công giám khảo theo cơ quan quản lý.',
  },
  [ADMIN_MODAL_ACTION.RETURN]: {
    title: 'Trả lại hồ sơ sản phẩm',
    description:
      'Hồ sơ sẽ chuyển về trạng thái Bị trả lại kèm lý do để người đăng ký chỉnh sửa và nộp lại.',
    reasonLabel: 'Lý do trả lại hồ sơ',
    requireReason: true,
    useTextarea: true,
    variant: 'destructive',
    confirmLabel: 'Xác nhận trả lại hồ sơ',
    pendingLabel: 'Đang trả lại…',
    successText: 'Đã trả lại hồ sơ cho người đăng ký.',
  },
  [ADMIN_MODAL_ACTION.PUBLISH]: {
    title: 'Công bố kết quả chấm điểm',
    description:
      'Sau khi công bố, người đăng ký và trang tra cứu công khai sẽ xem được điểm tổng hợp và mức sao của hồ sơ.',
    reasonLabel: 'Ghi chú (tùy chọn)',
    requireReason: false,
    variant: 'primary',
    confirmLabel: 'Xác nhận công bố kết quả',
    pendingLabel: 'Đang công bố…',
    successText: 'Đã công bố kết quả chấm điểm cho người đăng ký.',
  },
  [ADMIN_MODAL_ACTION.REOPEN]: {
    title: 'Mở lại hồ sơ đã hoàn tất',
    description:
      'Hồ sơ sẽ chuyển từ Hoàn tất về Đang chấm để Chủ trì / Quản trị có thể bổ sung giám khảo hoặc chờ phiếu chấm mới.',
    reasonLabel: 'Lý do mở lại hồ sơ',
    requireReason: true,
    confirmLabel: 'Xác nhận mở lại hồ sơ',
    pendingLabel: 'Đang mở lại…',
    successText: 'Đã mở lại hồ sơ để tiếp tục phân công/chấm điểm.',
  },
};

function getOwnerPendingResultMessage(flags: {
  isDraft: boolean;
  isReturned: boolean;
  isUpdatingResult: boolean;
  isCompleted: boolean;
  returnReason?: string | null;
}): string {
  if (flags.isDraft) return 'Hồ sơ chưa được nộp để đánh giá.';
  if (flags.isReturned) {
    return `Hồ sơ bị trả lại: ${flags.returnReason ?? 'Vui lòng chỉnh sửa và nộp lại.'}`;
  }
  if (flags.isUpdatingResult) {
    return 'Kết quả đánh giá đang được cập nhật do có phiếu chấm bổ sung và chờ Chủ trì/Quản trị công bố lại.';
  }
  if (flags.isCompleted) {
    return 'Hồ sơ đã hoàn tất chấm điểm và đang chờ Chủ trì/Quản trị công bố kết quả.';
  }
  return 'Hồ sơ đang chờ hội đồng hoàn tất đánh giá. Kết quả sẽ hiển thị tại đây sau khi được công bố.';
}

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
  const [assignmentModal, setAssignmentModal] = useState<
    | { kind: 'reopen-evaluation'; evaluationId: string; judgeName: string }
    | { kind: 'remove-assignment'; judgeId: string; judgeName: string }
    | null
  >(null);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [addingJudge, setAddingJudge] = useState(false);

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
    !isOwner &&
    (confirmAction !== null || removingAttachment !== null || assignmentModal !== null) &&
    reason.trim().length > 0;

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
    setAssignmentModal(null);
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
          await navigate({ to: listPath, search: listSearch });
          return;
        } finally {
          savedNavigation.current = false;
        }
      }
      await refetch();
      setConfirmAction(null);
      setRemovingAttachment(null);
      setAssignmentModal(null);
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
    setAddingJudge(true);
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
      await refetch();
      setRestoreConfirmPrompt(null);
      setSelectedAddJudgeId('');
      setAddJudgeReason('');
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
      setAddingJudge(false);
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.myProducts.listAll });
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
      queryClient.removeQueries({ queryKey: queryKeys.myProducts.detail(productId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myProducts.listAll });
      toast.success('Đã xóa bản nháp sản phẩm.');
      savedNavigation.current = true;
      try {
        await navigate({ to: '/my/products' });
      } finally {
        savedNavigation.current = false;
      }
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.myProducts.listAll });
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

  // Eligible judges for manual assignment on this product (filtered on the backend)
  const eligibleManualJudges = (judgesQuery.data ?? []) as EligibleManualJudge[];

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
            Mã hồ sơ: {displayProductCode(product)} · Người đăng ký:{' '}
            <strong>{registrantName}</strong>
            {registrantEmail ? ` (${registrantEmail})` : ''} · Phân loại: {product.category.name}
            {product.submittedAt ? ` · Ngày nộp: ${formatDateTime(product.submittedAt)}` : ''}
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

      {visibleError &&
        (isOwner ||
          (confirmAction === null && removingAttachment === null && assignmentModal === null)) && (
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
          {(() => {
            const activeAction = confirmAction ?? ADMIN_MODAL_ACTION.REOPEN;
            const modalConfig = ADMIN_MODAL_DIALOG_CONFIG[activeAction];
            const actionHandlers: Record<
              AdminModalAction,
              (confirmedReason: string) => Promise<unknown>
            > = {
              [ADMIN_MODAL_ACTION.SUBMIT]: (confirmedReason) => actions.submit(confirmedReason),
              [ADMIN_MODAL_ACTION.DELETE]: (confirmedReason) => actions.remove(confirmedReason),
              [ADMIN_MODAL_ACTION.APPROVE]: (confirmedReason) =>
                actions.approve(confirmedReason || undefined),
              [ADMIN_MODAL_ACTION.RETURN]: (confirmedReason) =>
                actions.returnProduct(confirmedReason),
              [ADMIN_MODAL_ACTION.PUBLISH]: (confirmedReason) =>
                actions.publishResults(confirmedReason || undefined),
              [ADMIN_MODAL_ACTION.REOPEN]: (confirmedReason) => actions.reopen(confirmedReason),
            };
            const submitBlocked =
              confirmAction === ADMIN_MODAL_ACTION.SUBMIT && savedSubmitIssues.length > 0;
            const confirmDisabled =
              busy || (modalConfig.requireReason && !reason.trim()) || submitBlocked;

            return (
              <Dialog
                open={confirmAction !== null}
                onOpenChange={(open) => {
                  if (!open) requestCloseDialog();
                }}
              >
                <DialogContent className='admin-dialog max-w-lg' data-admin-ui='true'>
                  <DialogHeader className='pr-6'>
                    <DialogTitle>{modalConfig.title}</DialogTitle>
                    <DialogDescription>{modalConfig.description}</DialogDescription>
                  </DialogHeader>
                  <div className='border-border bg-secondary/70 rounded-md border px-3.5 py-2.5 text-sm'>
                    <div className='text-fg font-semibold'>{product.name}</div>
                    <div className='text-muted mt-0.5 text-xs'>
                      Mã hồ sơ: {displayProductCode(product)}
                      {registrantName ? ` · ${registrantName}` : ''}
                    </div>
                  </div>
                  <div className='flex flex-col gap-4'>
                    <FormField
                      label={modalConfig.reasonLabel}
                      htmlFor='admin-product-action-reason'
                      required={modalConfig.requireReason}
                    >
                      {modalConfig.useTextarea ? (
                        <Textarea
                          id='admin-product-action-reason'
                          rows={4}
                          className='min-h-24 resize-y'
                          value={reason}
                          maxLength={255}
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
                    {submitBlocked || error ? (
                      <AlertError
                        title='Không thể thực hiện thao tác'
                        errors={submitBlocked ? savedSubmitIssues : [error]}
                      />
                    ) : null}
                    <DialogFooter className='pt-2'>
                      <Button
                        type='button'
                        variant='outline'
                        disabled={busy}
                        onClick={requestCloseDialog}
                      >
                        Hủy
                      </Button>
                      <Button
                        type='button'
                        variant={modalConfig.variant}
                        loading={busy}
                        disabled={confirmDisabled}
                        onClick={() =>
                          void runAdmin(actionHandlers[activeAction], {
                            requireReason: modalConfig.requireReason,
                            successText: modalConfig.successText,
                            returnToList: modalConfig.returnToList,
                          })
                        }
                      >
                        {busy ? modalConfig.pendingLabel : modalConfig.confirmLabel}
                      </Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>
            );
          })()}

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

          <Dialog
            open={assignmentModal !== null}
            onOpenChange={(open) => {
              if (!open) requestCloseDialog();
            }}
          >
            <DialogContent className='admin-dialog' data-admin-ui='true'>
              <DialogHeader>
                <DialogTitle>
                  {assignmentModal?.kind === 'reopen-evaluation'
                    ? `Mở lại phiếu chấm: ${assignmentModal.judgeName}`
                    : `Gỡ giám khảo khỏi hồ sơ: ${assignmentModal?.judgeName ?? ''}`}
                </DialogTitle>
                <DialogDescription>
                  {assignmentModal?.kind === 'reopen-evaluation'
                    ? 'Phiếu chấm sẽ chuyển về trạng thái đang chấm nháp để giám khảo chỉnh sửa và nộp lại.'
                    : 'Giám khảo sẽ bị gỡ khỏi phân công của hồ sơ này và phiếu chấm (nếu có) chuyển sang lịch sử.'}
                </DialogDescription>
              </DialogHeader>
              <div className='admin-form'>
                <FormField
                  label='Lý do thao tác (tùy chọn)'
                  htmlFor='admin-assignment-action-reason'
                >
                  <Input
                    id='admin-assignment-action-reason'
                    value={reason}
                    maxLength={255}
                    disabled={busy}
                    placeholder='Nhập lý do thao tác…'
                    onChange={(event) => setReason(event.target.value)}
                  />
                </FormField>
                {error && <AlertError title='Không thể thực hiện thao tác' errors={[error]} />}
                <div className='admin-actions'>
                  {assignmentModal?.kind === 'reopen-evaluation' ? (
                    <Button
                      type='button'
                      loading={busy}
                      disabled={busy}
                      onClick={() =>
                        void runAdmin(
                          (confirmedReason) =>
                            actions.reopenEvaluation(
                              assignmentModal.evaluationId,
                              confirmedReason || undefined,
                            ),
                          {
                            requireReason: false,
                            successText: 'Đã mở lại phiếu chấm để giám khảo chỉnh sửa.',
                          },
                        )
                      }
                    >
                      {busy ? 'Đang mở lại…' : 'Xác nhận mở lại phiếu'}
                    </Button>
                  ) : (
                    <Button
                      type='button'
                      variant='destructive'
                      loading={busy}
                      disabled={busy || !assignmentModal}
                      onClick={() =>
                        assignmentModal &&
                        assignmentModal.kind === 'remove-assignment' &&
                        void runAdmin(
                          (confirmedReason) =>
                            actions.removeAssignment(
                              assignmentModal.judgeId,
                              confirmedReason || undefined,
                            ),
                          {
                            requireReason: false,
                            successText: 'Đã gỡ giám khảo khỏi hồ sơ.',
                          },
                        )
                      }
                    >
                      {busy ? 'Đang gỡ…' : 'Xác nhận gỡ giám khảo'}
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
          <ProductInformationTab
            product={product}
            adminProduct={adminProduct}
            isOwner={isOwner}
            registrantName={registrantName}
            registrantEmail={registrantEmail}
            registrantPhone={registrantPhone}
            isPublished={isPublished}
            isUpdatingResult={isUpdatingResult}
            isCompleted={isCompleted}
            resultReady={resultReady}
          />
        </TabsContent>

        <TabsContent value={ADMIN_PRODUCT_DETAIL_TAB.REGISTRATION}>
          <ProductRegistrationTab product={product} isDraft={isDraft} formEntries={formEntries} />
        </TabsContent>

        <TabsContent value={ADMIN_PRODUCT_DETAIL_TAB.FILES}>
          <ProductFilesTab
            productId={product.id}
            productName={product.name}
            attachments={product.attachments}
            imageAttachments={imageAttachments}
            documentAttachments={documentAttachments}
            imageDimensions={imageDimensions}
            onSetImageDimensions={setImageDimensions}
            previewImageIndex={previewImageIndex}
            onPreviewImageIndexChange={setPreviewImageIndex}
            attachmentMode={attachmentMode}
            canDelete={(isOwner || canManage) && isEditable}
            busy={busy}
            onRequestRemoveAttachment={(attachment) => {
              setError('');
              setRemovingAttachment(attachment);
            }}
          />
        </TabsContent>

        <TabsContent value={ADMIN_PRODUCT_DETAIL_TAB.PROGRESS}>
          <ProductProgressTab
            product={product}
            adminProduct={adminProduct}
            ownerProduct={ownerProduct}
            isOwner={isOwner}
            isSubmitted={isSubmitted}
            canView={canView}
            isScoringOrApproved={isScoringOrApproved}
            busy={busy}
            addingJudge={addingJudge}
            restoreConfirmPromptOpen={Boolean(restoreConfirmPrompt)}
            selectedAddJudgeId={selectedAddJudgeId}
            onSelectedAddJudgeIdChange={setSelectedAddJudgeId}
            addJudgeReason={addJudgeReason}
            onAddJudgeReasonChange={setAddJudgeReason}
            eligibleManualJudges={eligibleManualJudges}
            onAddJudge={() => void handleAddJudge(false)}
            onRequestReopenEvaluation={(evaluationId, judgeName) => {
              setError('');
              setReason('Mở lại phiếu nộp nhầm để giám khảo chỉnh sửa');
              setAssignmentModal({
                kind: 'reopen-evaluation',
                evaluationId,
                judgeName,
              });
            }}
            onRequestRemoveAssignment={(judgeId, judgeName) => {
              setError('');
              setReason('Điều chỉnh phân công giám khảo');
              setAssignmentModal({
                kind: 'remove-assignment',
                judgeId,
                judgeName,
              });
            }}
          />
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
                  {getOwnerPendingResultMessage({
                    isDraft,
                    isReturned,
                    isUpdatingResult,
                    isCompleted,
                    returnReason: product.returnReason,
                  })}
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
