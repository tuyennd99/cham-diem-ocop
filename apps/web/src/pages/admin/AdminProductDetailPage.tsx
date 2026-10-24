import { useState } from 'react';
import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorText, messageOf } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { hasStaffPermission } from '../../lib/session-contract';
import { formatFormEntries } from '../../lib/utils';
import { AttachmentLink, PrivateAttachmentThumbnail } from '../../pages/registrant/AttachmentLink';
import {
  useAdminProductDetail,
  useAdminProductMutations,
  type AdminProductMode,
} from '../../queries/admin-products';
import { AdminProductResultsPage } from './AdminProductResultsPage';

export function AdminProductDetailPage({
  productId,
  mode,
}: {
  productId: string;
  mode: AdminProductMode;
}) {
  const navigate = useNavigate();
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const {
    data: response,
    error: loadError,
    isPending,
    refetch,
  } = useAdminProductDetail(mode, canManage, productId);
  const product = response?.data;
  const actions = useAdminProductMutations(productId, mode, canManage);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const visibleError = error || errorText(loadError);

  async function run(action: () => Promise<unknown>, returnToList = false) {
    if (busy || !reason.trim()) {
      setError('Nhập lý do thao tác trước khi tiếp tục.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await action();
      if (returnToList) {
        await navigate({ to: mode === 'products' ? '/admin/products' : '/admin/registrations' });
        return;
      }
      await refetch();
      setReason('');
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  if (isPending && !product) return <p>Đang tải hồ sơ…</p>;
  if (!product)
    return (
      <section>
        <p role='alert' className='form-note'>
          {visibleError || 'Không tìm thấy hồ sơ hoặc bạn không có quyền xem.'}
        </p>
        <Button variant='secondary' onClick={() => void refetch()}>
          Tải lại
        </Button>
        <Link to={mode === 'products' ? '/admin/products' : '/admin/registrations'}>
          Quay lại danh sách
        </Link>
      </section>
    );

  const isDraft = product.status === 'DRAFT';
  const formEntries = formatFormEntries(product.formData);
  return (
    <section className='route-panel'>
      <Link
        className='text-link'
        to={mode === 'products' ? '/admin/products' : '/admin/registrations'}
      >
        ← Danh sách
      </Link>
      <p className='eyebrow'>
        {product.category.groupName} · {product.category.name} · {product.status}
      </p>
      <h1>{product.name}</h1>
      <p>
        {product.registrant.fullName} · {product.registrant.email} · {product.registrant.id}
      </p>
      <div className='hero-actions'>
        <Link
          className='button button-secondary'
          to='/print/products/$id/registration'
          params={{ id: product.id }}
        >
          In phiếu đăng ký (Mẫu 01)
        </Link>
        {!isDraft && (
          <Link
            className='button button-secondary'
            to='/print/products/$id/results'
            params={{ id: product.id }}
          >
            In bảng tổng hợp kết quả
          </Link>
        )}
      </div>
      {canManage && isDraft && (
        <div className='hero-actions'>
          <Link
            className='button button-secondary'
            to='/admin/registrations/$id/edit'
            params={{ id: product.id }}
          >
            Sửa phiếu đăng ký
          </Link>
          <Button disabled={busy} onClick={() => void run(() => actions.submit(reason))}>
            Nộp thay
          </Button>
          <Button
            variant='secondary'
            disabled={busy}
            onClick={() => {
              if (window.confirm('Xóa bản nháp này?')) void run(() => actions.remove(reason), true);
            }}
          >
            Xóa nháp
          </Button>
        </div>
      )}
      {canManage && isDraft && (
        <label>
          Lý do thao tác
          <input
            value={reason}
            maxLength={255}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      )}
      {visibleError && (
        <p role='alert' className='form-note'>
          {visibleError}
        </p>
      )}
      <Tabs defaultValue='information'>
        <TabsList aria-label='Nội dung hồ sơ'>
          <TabsTrigger value='information'>Thông tin</TabsTrigger>
          <TabsTrigger value='registration'>Phiếu đăng ký</TabsTrigger>
          <TabsTrigger value='files'>Tệp</TabsTrigger>
          <TabsTrigger value='progress'>Tiến độ</TabsTrigger>
          <TabsTrigger value='results'>Kết quả</TabsTrigger>
        </TabsList>
        <TabsContent value='information'>
          <dl className='detail-facts'>
            <div>
              <dt>Mã hồ sơ</dt>
              <dd>{product.id}</dd>
            </div>
            <div>
              <dt>Chủ thể</dt>
              <dd>
                {product.registrant.fullName} · {product.registrant.email} ·{' '}
                {product.registrant.phone ?? '—'}
              </dd>
            </div>
            <div>
              <dt>Người nhập</dt>
              <dd>{product.createdBy?.fullName ?? 'Chủ thể tự nhập'}</dd>
            </div>
            <div>
              <dt>Danh mục</dt>
              <dd>
                {product.category.groupName} · {product.category.name}
              </dd>
            </div>
            <div>
              <dt>Địa bàn</dt>
              <dd>
                {product.locality
                  ? `${product.locality.name} · ${product.locality.provinceName}`
                  : 'Chưa gắn địa bàn'}
              </dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>{product.status}</dd>
            </div>
            <div>
              <dt>Ngày nộp</dt>
              <dd>
                {product.submittedAt ? new Date(product.submittedAt).toLocaleString('vi-VN') : '—'}
              </dd>
            </div>
            <div>
              <dt>Kết quả</dt>
              <dd>
                {product.status === 'COMPLETED'
                  ? `${product.finalScore ?? '—'} điểm · ${product.starRating ?? '—'} sao`
                  : 'Chưa có kết quả'}
              </dd>
            </div>
          </dl>
        </TabsContent>
        <TabsContent value='registration'>
          {product.registrationSnapshot ? (
            <>
              <p>
                Thông tin lưu tại thời điểm nộp ·{' '}
                {new Date(product.registrationSnapshot.submittedAt).toLocaleString('vi-VN')}
              </p>
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
                  <dt>Địa bàn khi nộp</dt>
                  <dd>
                    {product.registrationSnapshot.locality.name} ·{' '}
                    {product.registrationSnapshot.locality.provinceName}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p role='status'>Chưa có thông tin lưu tại thời điểm nộp.</p>
          )}
          {!product.registrationSnapshot && (
            <dl className='detail-facts'>
              {formEntries.map((entry) => (
                <div key={entry.key}>
                  <dt>{entry.label}</dt>
                  <dd>{entry.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </TabsContent>
        <TabsContent value='files'>
          {product.attachments.length ? (
            <ul>
              {product.attachments.map((file) => (
                <li key={file.id}>
                  {file.type === 'IMAGE' && (
                    <PrivateAttachmentThumbnail
                      mode='admin'
                      productId={product.id}
                      attachmentId={file.id}
                      name={file.fileName}
                    />
                  )}
                  <AttachmentLink
                    mode='admin'
                    productId={product.id}
                    attachmentId={file.id}
                    name={file.fileName}
                  />{' '}
                  · {file.type ?? 'Tệp'}
                  {canManage && isDraft && (
                    <Button
                      variant='secondary'
                      disabled={busy}
                      onClick={() => void run(() => actions.removeAttachment(file.id, reason))}
                    >
                      Xóa
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>Chưa có tệp đính kèm.</p>
          )}
        </TabsContent>
        <TabsContent value='progress'>
          <ol>
            {product.statusEvents.map((event) => (
              <li key={event.sequence}>
                {event.fromStatus ?? 'Mới tạo'} → {event.toStatus} ·{' '}
                {new Date(event.createdAt).toLocaleString('vi-VN')} · {event.reason ?? '—'}
              </li>
            ))}
          </ol>
        </TabsContent>
        <TabsContent value='results'>
          <AdminProductResultsPage productId={product.id} mode={mode} />
        </TabsContent>
      </Tabs>
      <Outlet />
    </section>
  );
}
