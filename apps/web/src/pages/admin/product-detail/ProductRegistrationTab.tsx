import { PageSection } from '@/layouts/PageLayout';
import type { RegistrantProduct } from '@/types/registrant';
import { formatDateTime } from '@/lib/admin-date';
import { formatFormEntries } from '@/lib/utils';
import type { AdminDetailProduct } from './shared';

export interface ProductRegistrationTabProps {
  product: AdminDetailProduct | RegistrantProduct;
  isDraft: boolean;
  formEntries: ReturnType<typeof formatFormEntries>;
}

export function ProductRegistrationTab({
  product,
  isDraft,
  formEntries,
}: ProductRegistrationTabProps) {
  return (
    <PageSection>
      {product.registrationSnapshot ? (
        <>
          <div className='mb-4'>
            <h2>Thông tin lưu tại thời điểm nộp</h2>
            <p className='text-muted text-sm'>
              Thời điểm chốt hồ sơ: {formatDateTime(product.registrationSnapshot.submittedAt)} (chỉ
              đọc).
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
  );
}
