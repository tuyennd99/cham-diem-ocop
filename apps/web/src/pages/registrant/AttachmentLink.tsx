import { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { PRODUCT_WORKSPACE_MODE } from '@/constants/consts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { judgeApi, myProductsApi } from '../../api';
import { adminProductsApi } from '../../api/admin-products';
import { messageOf } from '../../lib/api-error';
import { openAttachment } from '../../lib/attachments';
import { sessionStore } from '../../stores/session-store';

export type ProductAttachmentMode =
  | typeof PRODUCT_WORKSPACE_MODE.OWNER
  | typeof PRODUCT_WORKSPACE_MODE.ADMIN
  | typeof PRODUCT_WORKSPACE_MODE.JUDGE;

interface CachedAttachmentEntry {
  blob: Blob;
  objectUrl: string;
}

const MAX_CACHED_ATTACHMENTS = 150;
const attachmentCache = new Map<string, CachedAttachmentEntry>();
const inflightRequests = new Map<string, Promise<CachedAttachmentEntry>>();

function buildAttachmentCacheKey(productId: string, attachmentId: string): string {
  return `${productId}:${attachmentId}`;
}

export function clearAttachmentBlobCache(): void {
  for (const entry of attachmentCache.values()) {
    try {
      URL.revokeObjectURL(entry.objectUrl);
    } catch {
      // ignore revoke errors
    }
  }
  attachmentCache.clear();
  inflightRequests.clear();
}

// Clear private attachment object URLs whenever the authenticated user changes or logs out.
let lastUserId: string | null = sessionStore.getState().session?.user.id ?? null;
sessionStore.subscribe((state) => {
  const nextUserId = state.session?.user.id ?? null;
  if (nextUserId !== lastUserId) {
    lastUserId = nextUserId;
    clearAttachmentBlobCache();
  }
});

function requestRawAttachmentBlob(
  mode: ProductAttachmentMode,
  productId: string,
  attachmentId: string,
): Promise<Blob> {
  if (mode === PRODUCT_WORKSPACE_MODE.ADMIN) {
    return adminProductsApi.attachment(productId, attachmentId);
  }
  if (mode === PRODUCT_WORKSPACE_MODE.JUDGE) {
    return judgeApi.attachment(productId, attachmentId);
  }
  return myProductsApi.attachment(productId, attachmentId);
}

function touchCacheEntry(key: string, entry: CachedAttachmentEntry): CachedAttachmentEntry {
  attachmentCache.delete(key);
  attachmentCache.set(key, entry);
  while (attachmentCache.size > MAX_CACHED_ATTACHMENTS) {
    const oldestKey = attachmentCache.keys().next().value;
    if (!oldestKey) break;
    const oldest = attachmentCache.get(oldestKey);
    attachmentCache.delete(oldestKey);
    if (oldest) {
      try {
        URL.revokeObjectURL(oldest.objectUrl);
      } catch {
        // ignore
      }
    }
  }
  return entry;
}

export function getCachedAttachmentObjectUrl(
  productId: string,
  attachmentId: string,
): string | null {
  const key = buildAttachmentCacheKey(productId, attachmentId);
  const existing = attachmentCache.get(key);
  if (!existing) return null;
  return touchCacheEntry(key, existing).objectUrl;
}

export function loadAttachmentWithCache(
  mode: ProductAttachmentMode,
  productId: string,
  attachmentId: string,
): Promise<CachedAttachmentEntry> {
  const key = buildAttachmentCacheKey(productId, attachmentId);
  const cached = attachmentCache.get(key);
  if (cached) {
    return Promise.resolve(touchCacheEntry(key, cached));
  }
  const existingPromise = inflightRequests.get(key);
  if (existingPromise) {
    return existingPromise;
  }
  const promise = requestRawAttachmentBlob(mode, productId, attachmentId)
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      const entry = touchCacheEntry(key, { blob, objectUrl });
      inflightRequests.delete(key);
      return entry;
    })
    .catch((err) => {
      inflightRequests.delete(key);
      throw err;
    });
  inflightRequests.set(key, promise);
  return promise;
}

export function prefetchProductAttachments(
  mode: ProductAttachmentMode,
  productId: string,
  attachmentIds: readonly string[],
): void {
  for (const attachmentId of attachmentIds) {
    void loadAttachmentWithCache(mode, productId, attachmentId).catch(() => {
      // ignore background prefetch errors
    });
  }
}

export async function openProductAttachmentByMode(
  mode: ProductAttachmentMode,
  productId: string,
  attachmentId: string,
  name: string,
) {
  try {
    const { blob } = await loadAttachmentWithCache(mode, productId, attachmentId);
    await openAttachment(blob, name, true);
  } catch (e) {
    window.alert(messageOf(e));
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
  const [src, setSrc] = useState<string>(
    () => getCachedAttachmentObjectUrl(productId, attachmentId) ?? '',
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const cachedUrl = getCachedAttachmentObjectUrl(productId, attachmentId);
    if (cachedUrl) {
      setSrc(cachedUrl);
      setFailed(false);
      return;
    }
    setSrc('');
    setFailed(false);
    void loadAttachmentWithCache(mode, productId, attachmentId)
      .then((entry) => {
        if (active) setSrc(entry.objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
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
