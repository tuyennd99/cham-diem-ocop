import { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PRODUCT_WORKSPACE_MODE } from '@/constants/consts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { messageOf } from '../../lib/api-error';
import { openAttachment } from '../../lib/attachments';
import { useSession } from '../../lib/auth';
import {
  clearAttachmentBlobCache,
  getAttachmentCacheGeneration,
  getCachedAttachmentObjectUrl,
  isAttachmentSessionCurrent,
  isStaleAttachmentSessionError,
  loadAttachmentWithCache,
  prefetchProductAttachments,
  syncPrivateAttachmentLoad,
  type ProductAttachmentMode,
} from '../../lib/private-attachment-cache';
import { getSessionScope } from '../../lib/session-contract';

export {
  clearAttachmentBlobCache,
  getCachedAttachmentObjectUrl,
  loadAttachmentWithCache,
  prefetchProductAttachments,
  type ProductAttachmentMode,
};

export async function openProductAttachmentByMode(
  mode: ProductAttachmentMode,
  productId: string,
  attachmentId: string,
  name: string,
  download = true,
) {
  const generation = getAttachmentCacheGeneration();
  try {
    const { blob } = await loadAttachmentWithCache(mode, productId, attachmentId);
    if (!isAttachmentSessionCurrent(generation)) return;
    await openAttachment(blob, name, download);
  } catch (e) {
    if (isStaleAttachmentSessionError(e) || !isAttachmentSessionCurrent(generation)) return;
    toast.error(messageOf(e));
  }
}

export function AttachmentLink({
  mode = PRODUCT_WORKSPACE_MODE.OWNER,
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
  const sessionScope = getSessionScope(useSession());
  const [src, setSrc] = useState<string>(
    () => getCachedAttachmentObjectUrl(productId, attachmentId) ?? '',
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!sessionScope) {
      setSrc('');
      setFailed(false);
      return;
    }
    const cachedUrl = getCachedAttachmentObjectUrl(productId, attachmentId);
    if (cachedUrl) {
      setSrc(cachedUrl);
      setFailed(false);
      return;
    }
    setSrc('');
    setFailed(false);
    return syncPrivateAttachmentLoad(mode, productId, attachmentId, {
      onSuccess: (entry) => setSrc(entry.objectUrl),
      onError: () => setFailed(true),
    });
  }, [attachmentId, mode, productId, sessionScope]);

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
