import { useRef, useState } from 'react';
import { PageContainer, PageHeader, PageSection } from '@/layouts/PageLayout';
import type { ProductStatus } from '@ocop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useBlocker, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Maximize2,
  Trash2,
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { myProductsApi } from '../../api';
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
import { formatExactScore, formatStarRatingLabel } from '../../lib/print-format';
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
  type AdminProductMode,
} from '../../queries/admin-products';
import { useMyProduct } from '../../queries/registrant';
import type { RegistrantProduct } from '../../types/registrant';
import { AdminProductResultsPage } from './AdminProductResultsPage';

interface AdminProductDetailPageProps {
  productId: string;
  mode: AdminProductMode | 'owner';
  search?: AdminProductSearch;
  onSearchChange?: (next: AdminProductSearch) => void;
}

const VALID_TABS: readonly AdminProductDetailTab[] = [
  'information',
  'registration',
  'files',
  'progress',
  'results',
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

function formatAttachmentType(type?: 'IMAGE' | 'EVIDENCE'): string {
  if (type === 'IMAGE') return 'Hình ảnh sản phẩm';
  if (type === 'EVIDENCE') return 'Tài liệu minh chứng';
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

export function AdminProductDetailPage({
  productId,
  mode,
  search = { page: 1, limit: 20 },
  onSearchChange,
}: AdminProductDetailPageProps) {
  const isOwner = mode === 'owner';
  const adminMode: AdminProductMode = isOwner ? 'registrations' : mode;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const [fallbackTab, setFallbackTab] = useState<AdminProductDetailTab>('information');

  const rawTab = search.tab ?? fallbackTab;
  const selectedTab: AdminProductDetailTab = VALID_TABS.includes(rawTab) ? rawTab : 'information';
  const listSearch = toAdminProductApiQuery(search);
  const listPath =
    mode === 'owner'
      ? '/my/products'
      : mode === 'products'
        ? '/admin/products'
        : '/admin/registrations';
  const printSearch = { ...search, returnMode: adminMode };

  function changeDetailTab(value: string) {
    const nextTab = (
      VALID_TABS.includes(value as AdminProductDetailTab) ? value : 'information'
    ) as AdminProductDetailTab;
    if (onSearchChange) {
      onSearchChange({ ...search, tab: nextTab });
    } else {
      setFallbackTab(nextTab);
    }
  }

  const adminQuery = useAdminProductDetail(adminMode, canManage, productId, !isOwner);
  const ownerQuery = useMyProduct(isOwner ? productId : undefined);

  const adminProduct = !isOwner ? adminQuery.data?.data : undefined;
  const ownerProduct = isOwner ? ownerQuery.data : undefined;
  const product = adminProduct ?? ownerProduct;
  const loadError = isOwner ? ownerQuery.error : adminQuery.error;
  const isPending = isOwner ? ownerQuery.isPending : adminQuery.isPending;
  const refetch = isOwner ? ownerQuery.refetch : adminQuery.refetch;

  const actions = useAdminProductMutations(productId, adminMode, canManage);

  const [confirmAction, setConfirmAction] = useState<'submit' | 'delete' | null>(null);
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
    returnToList = false,
    successText?: string,
  ) {
    const trimmedReason = reason.trim();
    if (busy || !trimmedReason) {
      setError('Nhập lý do thao tác trước khi tiếp tục.');
      return;
    }
    setBusy(true);
    setError('');
    setStatusNote('');
    try {
      await action(trimmedReason);
      if (returnToList) {
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
      if (successText) setStatusNote(successText);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  async function submitOwner() {
    if (busy) return;
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

  const isDraft = product.status === 'DRAFT';
  const resultReady = product.status === 'COMPLETED' && typeof product.finalScore === 'number';
  const formEntries = formatFormEntries(product.formData);
  const attachmentMode = isOwner ? 'owner' : 'admin';
  const imageAttachments = product.attachments.filter((file) => file.type === 'IMAGE');
  const documentAttachments = product.attachments.filter((file) => file.type !== 'IMAGE');
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
            Mã hồ sơ: <span className='font-mono text-xs'>{product.id}</span> · Người đăng ký:{' '}
            <strong>{registrantName}</strong>
            {registrantEmail ? ` (${registrantEmail})` : ''} · Phân loại: {product.category.name}
            {product.submittedAt
              ? ` · Ngày nộp: ${new Date(product.submittedAt).toLocaleString('vi-VN')}`
              : ''}
          </>
        }
        actions={
          <>
            <Button asChild variant='secondary'>
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
                  <Button asChild variant='secondary'>
                    <Link to='/print/products/$id/results' params={{ id: product.id }}>
                      In kết quả đánh giá
                    </Link>
                  </Button>
                )
              : !isDraft && (
                  <Button asChild variant='secondary'>
                    <Link
                      to='/print/products/$id/results'
                      params={{ id: product.id }}
                      search={printSearch}
                    >
                      In bảng tổng hợp kết quả
                    </Link>
                  </Button>
                )}
            {isOwner && isDraft && (
              <>
                <Button asChild>
                  <Link to='/my/products/$id/edit' params={{ id: product.id }}>
                    Sửa bản nháp
                  </Link>
                </Button>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setConfirmAction('submit');
                  }}
                >
                  Nộp hồ sơ
                </Button>
                <Button
                  type='button'
                  variant='destructive'
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setConfirmAction('delete');
                  }}
                >
                  Xóa bản nháp
                </Button>
              </>
            )}
            {!isOwner && canManage && isDraft && (
              <>
                <Button asChild>
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
                  variant='secondary'
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setConfirmAction('submit');
                  }}
                >
                  Nộp thay
                </Button>
                <Button
                  type='button'
                  variant='destructive'
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setConfirmAction('delete');
                  }}
                >
                  Xóa bản nháp
                </Button>
              </>
            )}
          </>
        }
      />

      {statusNote && (
        <p className='form-message' role='status'>
          {statusNote}
        </p>
      )}

      {visibleError && (isOwner || (confirmAction === null && removingAttachment === null)) && (
        <AlertError title='Không thể thực hiện thao tác' errors={[visibleError]} />
      )}

      {isOwner ? (
        <>
          <ConfirmDialog
            open={confirmAction !== null}
            onOpenChange={(open) => {
              if (!open && !busy) setConfirmAction(null);
            }}
            title={
              confirmAction === 'submit'
                ? `Nộp hồ sơ: ${product.name}`
                : `Xóa bản nháp: ${product.name}`
            }
            description={
              confirmAction === 'submit'
                ? 'Sau khi nộp, hồ sơ được chuyển tới hội đồng chấm điểm và không thể sửa bản nháp.'
                : 'Bản nháp sẽ bị xóa vĩnh viễn và không thể khôi phục.'
            }
            confirmLabel={confirmAction === 'submit' ? 'Nộp hồ sơ' : 'Xóa bản nháp'}
            destructive={confirmAction === 'delete'}
            pending={busy}
            onConfirm={() => {
              if (confirmAction === 'submit') void submitOwner();
              else if (confirmAction === 'delete') void removeOwner();
            }}
          />

          <ConfirmDialog
            open={removingAttachment !== null}
            onOpenChange={(open) => {
              if (!open && !busy) setRemovingAttachment(null);
            }}
            title={`Xóa tệp đính kèm: ${removingAttachment?.fileName ?? ''}`}
            description='Tệp sẽ bị xóa khỏi bản nháp hồ sơ sản phẩm.'
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
                  {confirmAction === 'submit'
                    ? `Nộp hồ sơ thay người đăng ký: ${product.name}`
                    : `Xóa bản nháp: ${product.name}`}
                </DialogTitle>
                <DialogDescription>
                  {confirmAction === 'submit'
                    ? 'Sau khi nộp, hồ sơ được chốt thông tin đăng ký để chuyển sang bước phân công và chấm điểm.'
                    : 'Bản nháp sẽ bị xóa khỏi danh sách hồ sơ. Thao tác này yêu cầu ghi nhận lý do.'}
                </DialogDescription>
              </DialogHeader>
              <div className='admin-form'>
                <FormField label='Lý do thao tác' htmlFor='admin-product-action-reason'>
                  <Input
                    id='admin-product-action-reason'
                    value={reason}
                    maxLength={255}
                    disabled={busy}
                    onChange={(event) => setReason(event.target.value)}
                    required
                  />
                </FormField>
                {error && <AlertError title='Không thể thực hiện thao tác' errors={[error]} />}
                <div className='admin-actions'>
                  {confirmAction === 'submit' ? (
                    <Button
                      type='button'
                      loading={busy}
                      disabled={busy || !reason.trim()}
                      onClick={() =>
                        void runAdmin(
                          (confirmedReason) => actions.submit(confirmedReason),
                          false,
                          'Đã nộp hồ sơ thay người đăng ký.',
                        )
                      }
                    >
                      {busy ? 'Đang nộp…' : 'Nộp hồ sơ thay người đăng ký'}
                    </Button>
                  ) : (
                    <Button
                      type='button'
                      variant='destructive'
                      loading={busy}
                      disabled={busy || !reason.trim()}
                      onClick={() =>
                        void runAdmin((confirmedReason) => actions.remove(confirmedReason), true)
                      }
                    >
                      {busy ? 'Đang xóa…' : 'Xác nhận xóa bản nháp'}
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
                        false,
                        'Đã xóa tệp đính kèm.',
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
          <TabsTrigger value='information'>Thông tin</TabsTrigger>
          <TabsTrigger value='registration'>Phiếu đăng ký</TabsTrigger>
          <TabsTrigger value='files'>Tệp</TabsTrigger>
          <TabsTrigger value='progress'>Tiến độ</TabsTrigger>
          <TabsTrigger value='results'>Kết quả</TabsTrigger>
        </TabsList>

        <TabsContent value='information'>
          <PageSection>
            <dl className='detail-facts'>
              <div>
                <dt>Mã hồ sơ</dt>
                <dd className='font-mono text-xs'>{product.id}</dd>
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
              <div>
                <dt>Kết quả đánh giá</dt>
                <dd>
                  {product.status === 'COMPLETED' && product.finalScore !== null
                    ? `${formatExactScore(product.finalScore)} điểm · ${formatStarRatingLabel(product.starRating)}`
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

        <TabsContent value='registration'>
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

        <TabsContent value='files'>
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
                                  <span>Mở tệp gốc</span>
                                </Button>
                                {(isOwner || canManage) && isDraft && (
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
                              {(isOwner || canManage) && isDraft && (
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

          <Dialog
            open={activePreviewImage !== null}
            onOpenChange={(open) => {
              if (!open) setPreviewImageIndex(null);
            }}
          >
            <DialogContent className='admin-dialog attachment-lightbox-dialog' data-admin-ui='true'>
              {activePreviewImage && previewImageIndex !== null && (
                <>
                  <DialogHeader>
                    <DialogTitle className='attachment-lightbox-title'>
                      {activePreviewImage.fileName}
                    </DialogTitle>
                    <DialogDescription>
                      Ảnh {previewImageIndex + 1} / {imageAttachments.length} · Hồ sơ:{' '}
                      {product.name}
                      {imageDimensions[activePreviewImage.id]
                        ? ` · ${imageDimensions[activePreviewImage.id].width} × ${imageDimensions[activePreviewImage.id].height} px`
                        : ''}
                    </DialogDescription>
                  </DialogHeader>

                  <div className='attachment-lightbox-stage'>
                    <PrivateAttachmentThumbnail
                      mode={attachmentMode}
                      productId={product.id}
                      attachmentId={activePreviewImage.id}
                      name={activePreviewImage.fileName}
                    />
                  </div>

                  <div className='attachment-lightbox-footer'>
                    <div className='admin-actions'>
                      {imageAttachments.length > 1 && (
                        <>
                          <Button
                            type='button'
                            variant='secondary'
                            size='sm'
                            disabled={previewImageIndex <= 0}
                            onClick={() =>
                              setPreviewImageIndex((idx) =>
                                idx !== null ? Math.max(0, idx - 1) : 0,
                              )
                            }
                          >
                            <ChevronLeft className='size-4' aria-hidden='true' />
                            <span>Ảnh trước</span>
                          </Button>
                          <Button
                            type='button'
                            variant='secondary'
                            size='sm'
                            disabled={previewImageIndex >= imageAttachments.length - 1}
                            onClick={() =>
                              setPreviewImageIndex((idx) =>
                                idx !== null ? Math.min(imageAttachments.length - 1, idx + 1) : 0,
                              )
                            }
                          >
                            <span>Ảnh tiếp</span>
                            <ChevronRight className='size-4' aria-hidden='true' />
                          </Button>
                        </>
                      )}
                    </div>
                    <div className='admin-actions'>
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        onClick={() =>
                          void openProductAttachmentByMode(
                            attachmentMode,
                            product.id,
                            activePreviewImage.id,
                            activePreviewImage.fileName,
                          )
                        }
                      >
                        <ExternalLink className='size-3.5' aria-hidden='true' />
                        <span>Mở tệp gốc trong tab mới</span>
                      </Button>
                      <Button type='button' size='sm' onClick={() => setPreviewImageIndex(null)}>
                        Đóng
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value='progress'>
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
        </TabsContent>

        <TabsContent value='results'>
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
                    : 'Hồ sơ đang chờ hội đồng hoàn tất đánh giá. Kết quả sẽ hiển thị tại đây khi được tổng hợp.'}
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
