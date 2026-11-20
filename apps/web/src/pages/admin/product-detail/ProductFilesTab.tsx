import type { Dispatch, SetStateAction } from 'react';
import { PageSection } from '@/layouts/PageLayout';
import {
  AttachmentLink,
  openProductAttachmentByMode,
  PrivateAttachmentThumbnail,
  type ProductAttachmentMode,
} from '@/pages/registrant/AttachmentLink';
import type { ProductAttachment } from '@ocop/shared';
import { ExternalLink, FileText, Image as ImageIcon, Maximize2, Trash2 } from 'lucide-react';
import { MAX_PRODUCT_ATTACHMENTS } from '@/lib/attachments';
import { ImagePreviewDialog } from '@/components/image-preview-dialog';
import { Button } from '@/components/ui/button';
import { formatAttachmentType, getFileExtension } from './shared';

export interface ProductFilesTabProps {
  productId: string;
  productName: string;
  attachments: ProductAttachment[];
  imageAttachments: ProductAttachment[];
  documentAttachments: ProductAttachment[];
  imageDimensions: Record<string, { width: number; height: number }>;
  onSetImageDimensions: Dispatch<SetStateAction<Record<string, { width: number; height: number }>>>;
  previewImageIndex: number | null;
  onPreviewImageIndexChange: (index: number | null) => void;
  attachmentMode: ProductAttachmentMode;
  canDelete: boolean;
  busy: boolean;
  onRequestRemoveAttachment: (attachment: { id: string; fileName: string }) => void;
}

export function ProductFilesTab({
  productId,
  productName,
  attachments,
  imageAttachments,
  documentAttachments,
  imageDimensions,
  onSetImageDimensions,
  previewImageIndex,
  onPreviewImageIndexChange,
  attachmentMode,
  canDelete,
  busy,
  onRequestRemoveAttachment,
}: ProductFilesTabProps) {
  return (
    <>
      <PageSection className='attachment-dossier-section'>
        <div className='attachment-dossier-header'>
          <div className='attachment-dossier-title-group'>
            <h2>Tệp minh chứng và hình ảnh</h2>
            <p className='attachment-dossier-subtitle'>
              Tập hợp hình ảnh nhận diện sản phẩm và tài liệu pháp lý, chứng nhận chất lượng phục vụ
              hội đồng đánh giá.
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
                {attachments.length} / {MAX_PRODUCT_ATTACHMENTS} tệp
              </span>
            </span>
          </div>
        </div>

        {attachments.length ? (
          <div className='attachment-dossier-body'>
            {imageAttachments.length > 0 && (
              <section className='attachment-subsection' aria-label='Bộ sưu tập hình ảnh sản phẩm'>
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
                          onClick={() => onPreviewImageIndexChange(index)}
                          aria-label={`Phóng to hình ảnh ${file.fileName}`}
                        >
                          <span className='attachment-stage-badge'>{indexBadge}</span>
                          <div className='attachment-stage-canvas'>
                            <PrivateAttachmentThumbnail
                              mode={attachmentMode}
                              productId={productId}
                              attachmentId={file.id}
                              name={file.fileName}
                              onImageLoad={({ width, height }) =>
                                onSetImageDimensions((prev) =>
                                  prev[file.id]?.width === width && prev[file.id]?.height === height
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
                              productId={productId}
                              attachmentId={file.id}
                              name={file.fileName}
                              className='attachment-filename-link'
                            />
                          </div>

                          {imageAttachments.length === 1 && (
                            <p className='attachment-image-caption'>
                              Hình ảnh đại diện chính thức của hồ sơ <strong>{productName}</strong>{' '}
                              dùng để đối chiếu nhãn hàng hóa, bao bì và truy xuất nguồn gốc khi
                              chấm điểm.
                            </p>
                          )}

                          {canDelete && (
                            <div className='attachment-image-actions'>
                              <Button
                                type='button'
                                variant='secondary'
                                size='sm'
                                disabled={busy}
                                onClick={() =>
                                  onRequestRemoveAttachment({
                                    id: file.id,
                                    fileName: file.fileName,
                                  })
                                }
                              >
                                <Trash2 className='size-3.5' aria-hidden='true' />
                                <span>Xóa tệp</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {documentAttachments.length > 0 && (
              <section className='attachment-subsection' aria-label='Danh sách tài liệu minh chứng'>
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
                            productId={productId}
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
                                productId,
                                file.id,
                                file.fileName,
                              )
                            }
                          >
                            <ExternalLink className='size-3.5' aria-hidden='true' />
                            <span>Mở tài liệu</span>
                          </Button>
                          {canDelete && (
                            <Button
                              type='button'
                              variant='secondary'
                              size='sm'
                              disabled={busy}
                              onClick={() =>
                                onRequestRemoveAttachment({
                                  id: file.id,
                                  fileName: file.fileName,
                                })
                              }
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
          productId,
        }))}
        activeIndex={previewImageIndex}
        onIndexChange={onPreviewImageIndexChange}
        contextLabel={`Hồ sơ: ${productName}`}
      />
    </>
  );
}
