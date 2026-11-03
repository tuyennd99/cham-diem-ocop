import { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { judgeApi, myProductsApi } from '../../api';
import { adminProductsApi } from '../../api/admin-products';
import { messageOf } from '../../lib/api-error';
import { openAttachment } from '../../lib/attachments';

export type ProductAttachmentMode = 'owner' | 'admin' | 'judge';

function fetchAttachmentBlob(
  mode: ProductAttachmentMode,
  productId: string,
  attachmentId: string,
): Promise<Blob> {
  if (mode === 'admin') {
    return adminProductsApi.attachment(productId, attachmentId);
  }
  if (mode === 'judge') {
    return judgeApi.attachment(productId, attachmentId);
  }
  return myProductsApi.attachment(productId, attachmentId);
}

export async function openProductAttachmentByMode(
  mode: ProductAttachmentMode,
  productId: string,
  attachmentId: string,
  name: string,
) {
  try {
    const blob = await fetchAttachmentBlob(mode, productId, attachmentId);
    await openAttachment(blob, name, true);
  } catch (e) {
    window.alert(messageOf(e));
  }
}

export function AttachmentLink({
  mode = 'owner',
  productId,
  attachmentId,
  name,
  className,
}: {
  productId: string;
  attachmentId: string;
  name: string;
  mode?: ProductAttachmentMode;
  className?: string;
}) {
  return (
    <Button
      type='button'
      variant='link'
      className={cn(
        'attachment-link-btn text-link h-auto min-h-0 justify-start p-0 text-left font-semibold break-all whitespace-normal',
        className,
      )}
      onClick={() => void openProductAttachmentByMode(mode, productId, attachmentId, name)}
    >
      {name}
    </Button>
  );
}

export function PrivateAttachmentThumbnail({
  mode,
  productId,
  attachmentId,
  name,
  className,
  onImageLoad,
}: {
  mode: ProductAttachmentMode;
  productId: string;
  attachmentId: string;
  name: string;
  className?: string;
  onImageLoad?: (dimensions: { width: number; height: number; src: string }) => void;
}) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSrc('');
    setFailed(false);
    const request = fetchAttachmentBlob(mode, productId, attachmentId);
    void request
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setSrc(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, mode, productId]);

  if (failed) {
    return (
      <span className='attachment-thumb-placeholder is-error' role='status'>
        <ImageOff className='size-5' aria-hidden='true' />
        <span>Không tải được ảnh riêng tư</span>
      </span>
    );
  }
  if (!src) {
    return (
      <span className='attachment-thumb-placeholder is-loading' aria-busy='true'>
        <Loader2 className='size-5 animate-spin' aria-hidden='true' />
        <span>Đang tải ảnh…</span>
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      loading='lazy'
      className={className}
      onLoad={(event) => {
        const img = event.currentTarget;
        onImageLoad?.({
          width: img.naturalWidth,
          height: img.naturalHeight,
          src,
        });
      }}
    />
  );
}
