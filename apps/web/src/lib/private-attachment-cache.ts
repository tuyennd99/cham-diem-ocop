import { judgeApi, myProductsApi } from '../api';
import { adminProductsApi } from '../api/admin-products';
import { PRODUCT_WORKSPACE_MODE } from '../constants/consts';
import { sessionStore } from '../stores/session-store';
import { getSessionScope } from './session-contract';

export type ProductAttachmentMode =
  | typeof PRODUCT_WORKSPACE_MODE.OWNER
  | typeof PRODUCT_WORKSPACE_MODE.ADMIN
  | typeof PRODUCT_WORKSPACE_MODE.JUDGE;

export interface CachedAttachmentEntry {
  blob: Blob;
  objectUrl: string;
}

interface AttachmentCacheBucket {
  readonly generation: number;
  readonly scope: string;
  readonly cache: Map<string, CachedAttachmentEntry>;
  readonly inflight: Map<string, Promise<CachedAttachmentEntry>>;
  revoked: boolean;
}

const MAX_CACHED_ATTACHMENTS = 150;

export class StaleAttachmentSessionError extends Error {
  constructor() {
    super('Attachment request belongs to an expired session.');
    this.name = 'StaleAttachmentSessionError';
  }
}

export function isStaleAttachmentSessionError(error: unknown): boolean {
  return error instanceof StaleAttachmentSessionError;
}

let nextGeneration = 1;

function createBucket(scope: string): AttachmentCacheBucket {
  return {
    generation: nextGeneration++,
    scope,
    cache: new Map(),
    inflight: new Map(),
    revoked: false,
  };
}

let activeBucket = createBucket(getSessionScope(sessionStore.getState().session));

function buildAttachmentCacheKey(productId: string, attachmentId: string): string {
  return `${productId}:${attachmentId}`;
}

function revokeObjectUrlSafe(objectUrl: string): void {
  try {
    URL.revokeObjectURL(objectUrl);
  } catch {
    // ignore revoke errors
  }
}

export function clearAttachmentBlobCache(): void {
  const previous = activeBucket;
  previous.revoked = true;
  for (const entry of previous.cache.values()) {
    revokeObjectUrlSafe(entry.objectUrl);
  }
  previous.cache.clear();
  previous.inflight.clear();
  activeBucket = createBucket(getSessionScope(sessionStore.getState().session));
}

// Clear private attachment object URLs whenever the authenticated session changes or logs out.
sessionStore.subscribe((state) => {
  const nextScope = getSessionScope(state.session);
  if (nextScope !== activeBucket.scope) {
    clearAttachmentBlobCache();
  }
});

export function getAttachmentCacheGeneration(): number {
  return activeBucket.generation;
}

export function isAttachmentSessionCurrent(generation: number): boolean {
  return !activeBucket.revoked && activeBucket.generation === generation;
}

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

function touchCacheEntry(
  bucket: AttachmentCacheBucket,
  key: string,
  entry: CachedAttachmentEntry,
): CachedAttachmentEntry {
  bucket.cache.delete(key);
  bucket.cache.set(key, entry);
  while (bucket.cache.size > MAX_CACHED_ATTACHMENTS) {
    const oldestKey = bucket.cache.keys().next().value;
    if (!oldestKey) break;
    const oldest = bucket.cache.get(oldestKey);
    bucket.cache.delete(oldestKey);
    if (oldest) revokeObjectUrlSafe(oldest.objectUrl);
  }
  return entry;
}

export function getCachedAttachmentObjectUrl(
  productId: string,
  attachmentId: string,
): string | null {
  const bucket = activeBucket;
  const key = buildAttachmentCacheKey(productId, attachmentId);
  const existing = bucket.cache.get(key);
  if (!existing) return null;
  return touchCacheEntry(bucket, key, existing).objectUrl;
}

async function fetchAndCacheAttachment(
  bucket: AttachmentCacheBucket,
  key: string,
  mode: ProductAttachmentMode,
  productId: string,
  attachmentId: string,
): Promise<CachedAttachmentEntry> {
  try {
    const blob = await requestRawAttachmentBlob(mode, productId, attachmentId);
    if (bucket.revoked || bucket !== activeBucket) {
      throw new StaleAttachmentSessionError();
    }
    const objectUrl = URL.createObjectURL(blob);
    return touchCacheEntry(bucket, key, { blob, objectUrl });
  } catch (err) {
    if (bucket.revoked || bucket !== activeBucket) {
      throw new StaleAttachmentSessionError();
    }
    throw err;
  } finally {
    bucket.inflight.delete(key);
  }
}

export function loadAttachmentWithCache(
  mode: ProductAttachmentMode,
  productId: string,
  attachmentId: string,
): Promise<CachedAttachmentEntry> {
  const bucket = activeBucket;
  const key = buildAttachmentCacheKey(productId, attachmentId);
  const cached = bucket.cache.get(key);
  if (cached) {
    return Promise.resolve(touchCacheEntry(bucket, key, cached));
  }
  const existingPromise = bucket.inflight.get(key);
  if (existingPromise) {
    return existingPromise;
  }
  const promise = fetchAndCacheAttachment(bucket, key, mode, productId, attachmentId);
  bucket.inflight.set(key, promise);
  return promise;
}

export function prefetchProductAttachments(
  mode: ProductAttachmentMode,
  productId: string,
  attachmentIds: readonly string[],
): void {
  for (const attachmentId of attachmentIds) {
    void (async () => {
      try {
        await loadAttachmentWithCache(mode, productId, attachmentId);
      } catch {
        // ignore background prefetch errors
      }
    })();
  }
}

export function syncPrivateAttachmentLoad(
  mode: ProductAttachmentMode,
  productId: string,
  attachmentId: string,
  handlers: {
    onSuccess: (entry: CachedAttachmentEntry) => void;
    onError?: (error: unknown) => void;
    isActive?: () => boolean;
  },
): () => void {
  let active = true;
  const generation = getAttachmentCacheGeneration();
  const canUpdate = () =>
    active && (handlers.isActive?.() ?? true) && isAttachmentSessionCurrent(generation);

  void (async () => {
    try {
      const entry = await loadAttachmentWithCache(mode, productId, attachmentId);
      if (canUpdate()) handlers.onSuccess(entry);
    } catch (error) {
      if (canUpdate() && !isStaleAttachmentSessionError(error)) {
        handlers.onError?.(error);
      }
    }
  })();

  return () => {
    active = false;
  };
}
