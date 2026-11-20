import { PageSection } from '@/layouts';
import { AttachmentLink } from '@/pages/registrant/AttachmentLink';
import type { ProductAttachment } from '@ocop/shared';
import { ATTACHMENT_TYPE, PRODUCT_WORKSPACE_MODE } from '@/constants/consts';
import { isVideoFileName } from '@/lib/attachments';
import type { ImagePreviewItem } from '@/components/image-preview-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface DraftSavedAttachmentsSectionProps {
  mode: typeof PRODUCT_WORKSPACE_MODE.OWNER | typeof PRODUCT_WORKSPACE_MODE.ADMIN;
  productId: string;
  attachments: ProductAttachment[];
  previewItems: ImagePreviewItem[];
  onPreviewImage: (index: number) => void;
}

export function DraftSavedAttachmentsSection({
  mode,
  productId,
  attachments,
  previewItems,
  onPreviewImage,
}: DraftSavedAttachmentsSectionProps) {
  return (
    <PageSection aria-label='Tệp đã lưu' className='p-5'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm font-semibold'>Tệp đính kèm đã tải lên hồ sơ</p>
        <Badge variant='secondary'>{attachments.length} tệp đính kèm</Badge>
      </div>
      <ul className='draft-saved-attachments mt-3'>
        {attachments.map((file) => {
          const previewIdx =
            file.type === ATTACHMENT_TYPE.IMAGE && !isVideoFileName(file.fileName)
              ? previewItems.findIndex((item) => item.id === file.id)
              : -1;
          return (
            <li key={file.id} className='draft-saved-attachment-item'>
              <span className='attachment-ext-tag'>
                {isVideoFileName(file.fileName)
                  ? 'VIDEO'
                  : file.type === ATTACHMENT_TYPE.IMAGE
                    ? 'ẢNH'
                    : 'TÀI LIỆU'}
              </span>
              {previewIdx >= 0 ? (
                <Button
                  type='button'
                  variant='link'
                  className='attachment-link-btn text-link h-auto min-h-0 justify-start p-0 text-left font-semibold break-all whitespace-normal'
                  onClick={() => onPreviewImage(previewIdx)}
                >
                  {file.fileName}
                </Button>
              ) : (
                <AttachmentLink
                  mode={mode}
                  productId={productId}
                  attachmentId={file.id}
                  name={file.fileName}
                />
              )}
            </li>
          );
        })}
      </ul>
    </PageSection>
  );
}
