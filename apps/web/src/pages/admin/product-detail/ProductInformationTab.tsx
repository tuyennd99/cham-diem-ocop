import { PageSection } from '@/layouts/PageLayout';
import type { RegistrantProduct } from '@/types/registrant';
import { formatDateTime } from '@/lib/admin-date';
import { displayProductCode, formatExactScore, formatStarRatingLabel } from '@/lib/print-format';
import { formatStatusLabel, type AdminDetailProduct } from './shared';

export interface ProductInformationTabProps {
  product: AdminDetailProduct | RegistrantProduct;
  adminProduct: AdminDetailProduct | undefined;
  isOwner: boolean;
  registrantName: string;
  registrantEmail: string;
  registrantPhone: string | null;
  isPublished: boolean;
  isUpdatingResult: boolean;
  isCompleted: boolean;
  resultReady: boolean;
}

export function ProductInformationTab({
  product,
  adminProduct,
  isOwner,
  registrantName,
  registrantEmail,
  registrantPhone,
  isPublished,
  isUpdatingResult,
  isCompleted,
  resultReady,
}: ProductInformationTabProps) {
  return (
    <PageSection>
      <dl className='detail-facts'>
        <div>
          <dt>Mã hồ sơ</dt>
          <dd>{displayProductCode(product)}</dd>
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
              <dt>Cơ quan chủ trì</dt>
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
          <dd>{product.submittedAt ? formatDateTime(product.submittedAt) : 'Chưa nộp'}</dd>
        </div>
        {adminProduct?.approvedAt && (
          <div>
            <dt>Thời điểm duyệt hồ sơ</dt>
            <dd>
              {formatDateTime(adminProduct.approvedAt)}
              {adminProduct.approvedBy ? ` · bởi ${adminProduct.approvedBy.fullName}` : ''}
            </dd>
          </div>
        )}
        <div>
          <dt>Trạng thái công bố kết quả</dt>
          <dd>
            {isPublished
              ? `Đã công bố${product.publishedAt ? ` (${formatDateTime(product.publishedAt)})` : ''}`
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
  );
}
