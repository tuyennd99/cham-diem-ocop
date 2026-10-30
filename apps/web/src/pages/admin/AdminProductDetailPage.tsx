import { useRef, useState } from 'react';
import type { ProductStatus } from '@ocop/shared';
import { Link, Outlet, useBlocker, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import AlertError from '@/components/alert-error';
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
import { ADMIN_DASHBOARD_STATUS_LABEL } from '../../constants/product-status';
import {
  toAdminProductApiQuery,
  type AdminProductDetailTab,
  type AdminProductSearch,
} from '../../lib/admin-search';
import { errorText, messageOf } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { formatExactScore, formatStarRatingLabel } from '../../lib/print-format';
import { hasStaffPermission } from '../../lib/session-contract';
import { formatFormEntries } from '../../lib/utils';
import { AttachmentLink, PrivateAttachmentThumbnail } from '../../pages/registrant/AttachmentLink';
import {
  useAdminProductDetail,
  useAdminProductMutations,
  type AdminProductMode,
} from '../../queries/admin-products';
import { AdminProductResultsPage } from './AdminProductResultsPage';

interface AdminProductDetailPageProps {
  productId: string;
  mode: AdminProductMode;
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

function formatStatusLabel(status: ProductStatus | string | null | undefined): string {
  if (!status) return 'Mới tạo';
  return ADMIN_DASHBOARD_STATUS_LABEL[status as ProductStatus] ?? status;
}

function formatAttachmentType(type?: 'IMAGE' | 'EVIDENCE'): string {
  if (type === 'IMAGE') return 'Hình ảnh sản phẩm';
  if (type === 'EVIDENCE') return 'Tài liệu minh chứng';
  return 'Tệp đính kèm';
}

export function AdminProductDetailPage({
  productId,
  mode,
  search = { page: 1, limit: 20 },
  onSearchChange,
}: AdminProductDetailPageProps) {
  const navigate = useNavigate();
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const [fallbackTab, setFallbackTab] = useState<AdminProductDetailTab>('information');

  const rawTab = search.tab ?? fallbackTab;
  const selectedTab: AdminProductDetailTab = VALID_TABS.includes(rawTab) ? rawTab : 'information';
  const listSearch = toAdminProductApiQuery(search);
  const listPath = mode === 'products' ? '/admin/products' : '/admin/registrations';
  const printSearch = { ...search, returnMode: mode };

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

  const {
    data: response,
    error: loadError,
    isPending,
    refetch,
  } = useAdminProductDetail(mode, canManage, productId);
  const product = response?.data;
  const actions = useAdminProductMutations(productId, mode, canManage);

  const [confirmAction, setConfirmAction] = useState<'submit' | 'delete' | null>(null);
  const [removingAttachment, setRemovingAttachment] = useState<{
    id: string;
    fileName: string;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [busy, setBusy] = useState(false);
  const savedNavigation = useRef(false);

  const hasDirtyReason =
    (confirmAction !== null || removingAttachment !== null) && reason.trim().length > 0;

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

  async function run(
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

  const visibleError = error || errorText(loadError);

  if (isPending && !product) {
    return (
      <section className='admin-page' aria-busy='true'>
        <PageSpin />
      </section>
    );
  }

  if (!product) {
    return (
      <section className='admin-page'>
        <AlertError
          title='Không thể tải hồ sơ'
          errors={[visibleError || 'Không tìm thấy hồ sơ hoặc bạn không có quyền xem.']}
        />
        <div className='admin-actions'>
          <Button type='button' variant='secondary' onClick={() => void refetch()}>
            Thử lại
          </Button>
          <Button asChild variant='secondary'>
            <Link to={listPath} search={listSearch}>
              Quay lại danh sách
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  const isDraft = product.status === 'DRAFT';
  const formEntries = formatFormEntries(product.formData);
  const statusVariant =
    product.status === 'DRAFT' ? 'secondary' : product.status === 'SCORING' ? 'outline' : 'default';

  return (
    <section className='admin-page'>
      <div>
        <Link className='text-link text-sm' to={listPath} search={listSearch}>
          <ArrowLeft size={16} aria-hidden='true' /> Quay lại danh sách
        </Link>
      </div>

      <div className='admin-page-heading'>
        <div>
          <div className='flex flex-wrap items-center gap-3'>
            <h1>{product.name}</h1>
            <Badge variant={statusVariant}>{formatStatusLabel(product.status)}</Badge>
          </div>
          <p className='route-intro'>
            Mã hồ sơ: <span className='font-mono text-xs'>{product.id}</span> · Người đăng ký:{' '}
            <strong>{product.registrant.fullName}</strong> ({product.registrant.email}) · Phân loại:{' '}
            {product.category.name}
            {product.submittedAt
              ? ` · Ngày nộp: ${new Date(product.submittedAt).toLocaleString('vi-VN')}`
              : ''}
          </p>
        </div>

        <div className='admin-actions'>
          <Button asChild variant='secondary'>
            <Link
              to='/print/products/$id/registration'
              params={{ id: product.id }}
              search={printSearch}
            >
              In phiếu đăng ký (Mẫu 01)
            </Link>
          </Button>
          {!isDraft && (
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
          {canManage && isDraft && (
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
        </div>
      </div>

      {statusNote && (
        <p className='form-message' role='status'>
          {statusNote}
        </p>
      )}

      {visibleError && confirmAction === null && removingAttachment === null && (
        <AlertError title='Không thể thực hiện thao tác' errors={[visibleError]} />
      )}

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
                    void run(
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
                    void run((confirmedReason) => actions.remove(confirmedReason), true)
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
            <DialogDescription>Nhập lý do xóa tệp khỏi bản nháp hồ sơ sản phẩm.</DialogDescription>
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
                  void run(
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

      <Tabs value={selectedTab} onValueChange={changeDetailTab}>
        <TabsList aria-label='Nội dung hồ sơ'>
          <TabsTrigger value='information'>Thông tin</TabsTrigger>
          <TabsTrigger value='registration'>Phiếu đăng ký</TabsTrigger>
          <TabsTrigger value='files'>Tệp</TabsTrigger>
          <TabsTrigger value='progress'>Tiến độ</TabsTrigger>
          <TabsTrigger value='results'>Kết quả</TabsTrigger>
        </TabsList>

        <TabsContent value='information'>
          <div className='admin-table-region p-6'>
            <dl className='detail-facts'>
              <div>
                <dt>Mã hồ sơ</dt>
                <dd className='font-mono text-xs'>{product.id}</dd>
              </div>
              <div>
                <dt>Người đăng ký</dt>
                <dd>
                  {product.registrant.fullName} · {product.registrant.email} ·{' '}
                  {product.registrant.phone ?? 'Chưa có điện thoại'}
                </dd>
              </div>
              <div>
                <dt>Người tạo hồ sơ</dt>
                <dd>{product.createdBy?.fullName ?? 'Người đăng ký tự nhập'}</dd>
              </div>
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
                <dd>{formatStatusLabel(product.status)}</dd>
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
          </div>
        </TabsContent>

        <TabsContent value='registration'>
          <div className='admin-table-region p-6'>
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
          </div>
        </TabsContent>

        <TabsContent value='files'>
          <div className='admin-table-region p-6'>
            <h2 className='mb-3'>Tệp minh chứng và hình ảnh</h2>
            {product.attachments.length ? (
              <ul className='record-list' style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {product.attachments.map((file) => (
                  <li className='record-row items-center' key={file.id}>
                    <div className='flex min-w-0 items-center gap-3'>
                      {file.type === 'IMAGE' && (
                        <PrivateAttachmentThumbnail
                          mode='admin'
                          productId={product.id}
                          attachmentId={file.id}
                          name={file.fileName}
                        />
                      )}
                      <div className='min-w-0'>
                        <AttachmentLink
                          mode='admin'
                          productId={product.id}
                          attachmentId={file.id}
                          name={file.fileName}
                        />
                        <p className='text-muted mt-0.5 text-xs'>
                          {formatAttachmentType(file.type)}
                        </p>
                      </div>
                    </div>
                    {canManage && isDraft && (
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        disabled={busy}
                        onClick={() => {
                          setError('');
                          setRemovingAttachment({ id: file.id, fileName: file.fileName });
                        }}
                      >
                        Xóa tệp
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className='text-muted text-sm'>Hồ sơ chưa có tệp đính kèm.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value='progress'>
          <div className='admin-table-region p-6'>
            <h2 className='mb-3'>Lịch sử trạng thái hồ sơ</h2>
            {product.statusEvents.length > 0 ? (
              <ol className='record-list' style={{ paddingLeft: '20px', margin: 0 }}>
                {product.statusEvents.map((event) => (
                  <li className='border-border border-b py-2 last:border-b-0' key={event.sequence}>
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
            )}
          </div>
        </TabsContent>

        <TabsContent value='results'>
          <AdminProductResultsPage productId={product.id} mode={mode} printSearch={printSearch} />
        </TabsContent>
      </Tabs>
      <Outlet />
    </section>
  );
}
