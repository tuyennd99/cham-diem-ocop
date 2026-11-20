import { CheckCircle2, CircleDashed } from 'lucide-react';
import type { RegistrantFormData, RegistrantProduct } from '@/types/registrant';
import { PRODUCT_STATUS } from '@/constants/consts';
import { MAX_PRODUCT_FILES, MAX_PRODUCT_VIDEOS } from '@/lib/attachments';
import type { ProductEditorCategory } from '@/lib/product-editor-categories';
import { canStartProductDraftSave } from '@/lib/save-product-draft';
import { Button } from '@/components/ui/button';

export interface DraftSummaryAsideProps {
  currentValues: RegistrantFormData & {
    name: string;
    description: string;
    categoryId: string;
    localityId: string;
    localityName: string;
    localityCode: string;
  };
  product: RegistrantProduct | null;
  selectedCategoryObj: ProductEditorCategory | undefined;
  hasCompleteLocality: boolean;
  selectedLocalityDisplay: string | null;
  unsavedPrefilledFields: string[];
  totalRegularFilesCount: number;
  totalVideoFilesCount: number;
  busy: boolean;
  activeSubmitIntent: 'draft' | 'submit';
  reviewRequired: boolean;
  createOutcomeUnknown: boolean;
  onSelectSubmitIntent: (intent: 'draft' | 'submit') => void;
}

export function DraftSummaryAside({
  currentValues,
  product,
  selectedCategoryObj,
  hasCompleteLocality,
  selectedLocalityDisplay,
  unsavedPrefilledFields,
  totalRegularFilesCount,
  totalVideoFilesCount,
  busy,
  activeSubmitIntent,
  reviewRequired,
  createOutcomeUnknown,
  onSelectSubmitIntent,
}: DraftSummaryAsideProps) {
  const canStart = canStartProductDraftSave({
    reviewRequired,
    createOutcomeUnknown,
  });

  return (
    <aside className='draft-summary-aside' aria-label='Tóm tắt hồ sơ đang nhập'>
      <div className='draft-summary-card'>
        <div className='draft-summary-head'>
          <h3>Tóm tắt phiếu đăng ký</h3>
        </div>
        <p className='draft-summary-note'>
          Hoàn thành đầy đủ các mục đánh dấu <strong>*</strong> và ít nhất{' '}
          <strong>Số điện thoại hoặc Email</strong> trước khi lưu bản nháp hoặc nộp hồ sơ.
        </p>
        {unsavedPrefilledFields.length > 0 && (
          <div
            role='status'
            className='rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200'
          >
            <strong>Dữ liệu tự điền chưa được lưu:</strong> {unsavedPrefilledFields.join(', ')}. Bấm{' '}
            <strong>Lưu bản nháp</strong> hoặc <strong>Lưu hồ sơ</strong> để lưu vào hệ thống.
          </div>
        )}

        <ul className='draft-checklist'>
          <li className={currentValues.name.trim() ? 'is-done' : undefined}>
            {currentValues.name.trim() ? (
              <CheckCircle2 className='size-4' aria-hidden='true' />
            ) : (
              <CircleDashed className='size-4' aria-hidden='true' />
            )}
            <div>
              <strong>
                Tên sản phẩm{' '}
                <span className='label-required-mark' aria-hidden='true'>
                  *
                </span>
              </strong>
              <span>{currentValues.name.trim() || 'Chưa nhập tên sản phẩm'}</span>
            </div>
          </li>
          <li
            className={
              currentValues.categoryId && !selectedCategoryObj?.unavailable ? 'is-done' : undefined
            }
          >
            {currentValues.categoryId && !selectedCategoryObj?.unavailable ? (
              <CheckCircle2 className='size-4' aria-hidden='true' />
            ) : (
              <CircleDashed className='size-4' aria-hidden='true' />
            )}
            <div>
              <strong>
                Danh mục sản phẩm{' '}
                <span className='label-required-mark' aria-hidden='true'>
                  *
                </span>
              </strong>
              <span>
                {selectedCategoryObj
                  ? selectedCategoryObj.unavailable
                    ? `${selectedCategoryObj.name} (ngừng sử dụng — cần đổi khi nộp)`
                    : selectedCategoryObj.name
                  : 'Chưa chọn danh mục'}
              </span>
            </div>
          </li>
          <li className={hasCompleteLocality ? 'is-done' : undefined}>
            {hasCompleteLocality ? (
              <CheckCircle2 className='size-4' aria-hidden='true' />
            ) : (
              <CircleDashed className='size-4' aria-hidden='true' />
            )}
            <div>
              <strong>
                Địa bàn hành chính{' '}
                <span className='label-required-mark' aria-hidden='true'>
                  *
                </span>
              </strong>
              <span>
                {hasCompleteLocality
                  ? selectedLocalityDisplay
                  : !currentValues.provinceName.trim()
                    ? 'Chưa chọn Tỉnh/Thành phố và Xã/Phường'
                    : 'Chưa chọn Xã/Phường'}
              </span>
            </div>
          </li>
          <li className={currentValues.declarationAccepted ? 'is-done' : undefined}>
            {currentValues.declarationAccepted ? (
              <CheckCircle2 className='size-4' aria-hidden='true' />
            ) : (
              <CircleDashed className='size-4' aria-hidden='true' />
            )}
            <div>
              <strong>
                Cam kết chủ thể OCOP{' '}
                <span className='label-required-mark' aria-hidden='true'>
                  *
                </span>
              </strong>
              <span>
                {currentValues.declarationAccepted
                  ? 'Đã xác nhận cam kết'
                  : 'Cần xác nhận trước khi lưu'}
              </span>
            </div>
          </li>
        </ul>

        <dl className='draft-summary-facts'>
          <div>
            <dt>Đơn vị sản xuất</dt>
            <dd>{currentValues.entityName?.trim() || 'Chưa khai báo'}</dd>
          </div>
          <div>
            <dt>Số điện thoại</dt>
            <dd>{currentValues.phone?.trim() || 'Chưa khai báo'}</dd>
          </div>
          <div>
            <dt>Email liên hệ</dt>
            <dd>{currentValues.email?.trim() || 'Chưa khai báo'}</dd>
          </div>
          <div>
            <dt>Năm đánh giá</dt>
            <dd>{currentValues.assessmentYear.trim() || 'Chưa nhập'}</dd>
          </div>
          <div>
            <dt>Tệp ảnh / PDF</dt>
            <dd>
              {totalRegularFilesCount} / {MAX_PRODUCT_FILES} tệp (≤ 2 MB)
            </dd>
          </div>
          <div>
            <dt>Video sản phẩm</dt>
            <dd>
              {totalVideoFilesCount} / {MAX_PRODUCT_VIDEOS} video (≤ 50 MB)
            </dd>
          </div>
        </dl>

        <div className='draft-summary-actions'>
          <Button
            type='submit'
            form='product-draft-form'
            data-submit-intent='submit'
            variant='primary'
            className='w-full'
            loading={busy && activeSubmitIntent === 'submit'}
            disabled={busy || !canStart}
            onClick={() => onSelectSubmitIntent('submit')}
          >
            {busy && activeSubmitIntent === 'submit'
              ? 'Đang lưu và nộp…'
              : product?.status === PRODUCT_STATUS.RETURNED
                ? 'Lưu và nộp lại'
                : 'Lưu hồ sơ'}
          </Button>
          <Button
            type='submit'
            form='product-draft-form'
            data-submit-intent='draft'
            variant='secondary'
            className='w-full'
            loading={busy && activeSubmitIntent === 'draft'}
            disabled={busy || !canStart}
            onClick={() => onSelectSubmitIntent('draft')}
          >
            {busy && activeSubmitIntent === 'draft'
              ? 'Đang lưu…'
              : product?.status === PRODUCT_STATUS.RETURNED
                ? 'Lưu thay đổi'
                : 'Lưu bản nháp'}
          </Button>
        </div>
      </div>
    </aside>
  );
}
