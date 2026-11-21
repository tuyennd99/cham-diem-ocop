import { useEffect, useMemo, useState } from 'react';
import Lightbox, { type SlideImage } from 'yet-another-react-lightbox';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Download from 'yet-another-react-lightbox/plugins/download';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import {
  getCachedAttachmentObjectUrl,
  prefetchProductAttachments,
  type ProductAttachmentMode,
} from '@/pages/registrant/AttachmentLink';
import { useSession } from '@/lib/auth';
import { syncPrivateAttachmentLoad } from '@/lib/private-attachment-cache';
import { getSessionScope } from '@/lib/session-contract';

export type ImagePreviewItem =
  | {
      kind: 'private';
      id: string;
      name: string;
      mode: ProductAttachmentMode;
      productId: string;
    }
  | {
      kind: 'url';
      id: string;
      name: string;
      url: string;
      onOpenOriginal?: () => void;
    }
  | {
      kind: 'file';
      id: string;
      name: string;
      file: File;
    };

export interface ImagePreviewDialogProps {
  items: ImagePreviewItem[];
  activeIndex: number | null;
  onIndexChange: (nextIndex: number | null) => void;
  contextLabel?: string;
}

const TRANSPARENT_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const fileObjectUrlCache = new WeakMap<File, string>();

function getOrCreateFileObjectUrl(file: File): string {
  const existing = fileObjectUrlCache.get(file);
  if (existing) return existing;
  const created = URL.createObjectURL(file);
  fileObjectUrlCache.set(file, created);
  return created;
}

export function ImagePreviewDialog({ items, activeIndex, onIndexChange }: ImagePreviewDialogProps) {
  const sessionScope = getSessionScope(useSession());
  const isOpen = activeIndex !== null && activeIndex >= 0 && activeIndex < items.length;
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of items) {
      if (item.kind === 'private') {
        if (!sessionScope) continue;
        const cached = getCachedAttachmentObjectUrl(item.productId, item.id);
        if (cached) initial[item.id] = cached;
      } else if (item.kind === 'url') {
        initial[item.id] = item.url;
      } else if (item.kind === 'file') {
        initial[item.id] = getOrCreateFileObjectUrl(item.file);
      }
    }
    return initial;
  });

  // Proactively prefetch and cache all private attachments in the current collection
  // so opening the lightbox or switching between images is instantaneous.
  useEffect(() => {
    let active = true;
    const cleanups: Array<() => void> = [];
    const nextResolved: Record<string, string> = {};
    const privateByProduct = new Map<
      string,
      { mode: ProductAttachmentMode; productId: string; ids: string[] }
    >();

    for (const item of items) {
      if (item.kind === 'private') {
        if (!sessionScope) continue;
        const cached = getCachedAttachmentObjectUrl(item.productId, item.id);
        if (cached) {
          nextResolved[item.id] = cached;
        } else {
          cleanups.push(
            syncPrivateAttachmentLoad(item.mode, item.productId, item.id, {
              isActive: () => active,
              onSuccess: (entry) => {
                setResolvedUrls((prev) =>
                  prev[item.id] === entry.objectUrl
                    ? prev
                    : { ...prev, [item.id]: entry.objectUrl },
                );
              },
            }),
          );
        }
        const groupKey = `${item.mode}:${item.productId}`;
        const group = privateByProduct.get(groupKey) ?? {
          mode: item.mode,
          productId: item.productId,
          ids: [],
        };
        group.ids.push(item.id);
        privateByProduct.set(groupKey, group);
      } else if (item.kind === 'url') {
        nextResolved[item.id] = item.url;
      } else if (item.kind === 'file') {
        nextResolved[item.id] = getOrCreateFileObjectUrl(item.file);
      }
    }

    setResolvedUrls(nextResolved);

    for (const group of privateByProduct.values()) {
      prefetchProductAttachments(group.mode, group.productId, group.ids);
    }

    return () => {
      active = false;
      for (const cancel of cleanups) cancel();
    };
  }, [items, sessionScope]);

  const slides = useMemo<SlideImage[]>(
    () =>
      items.map((item) => {
        const src =
          resolvedUrls[item.id] ??
          (item.kind === 'private'
            ? (getCachedAttachmentObjectUrl(item.productId, item.id) ?? TRANSPARENT_PLACEHOLDER)
            : item.kind === 'url'
              ? item.url
              : getOrCreateFileObjectUrl(item.file));

        return {
          src,
          alt: item.name,
          title: item.name,
          download:
            src !== TRANSPARENT_PLACEHOLDER
              ? {
                  url: src,
                  filename: item.name,
                }
              : false,
        };
      }),
    [items, resolvedUrls],
  );

  if (!items.length) return null;

  const plugins =
    items.length > 1
      ? [Captions, Download, Fullscreen, Thumbnails, Zoom]
      : [Captions, Download, Fullscreen, Zoom];

  return (
    <Lightbox
      open={isOpen}
      close={() => onIndexChange(null)}
      index={activeIndex ?? 0}
      slides={slides}
      plugins={plugins}
      carousel={{
        finite: true,
        preload: Math.min(items.length, 5),
      }}
      controller={{
        closeOnBackdropClick: true,
      }}
      zoom={{
        maxZoomPixelRatio: 4,
        scrollToZoom: true,
      }}
      thumbnails={{
        position: 'bottom',
        width: 84,
        height: 60,
        border: 1,
        borderRadius: 6,
        padding: 2,
        gap: 10,
      }}
      styles={{
        root: {
          '--yarl__color_backdrop': 'rgba(12, 22, 16, 0.72)',
          '--yarl__container_background_color': 'transparent',
          '--yarl__thumbnails_container_background_color': 'rgba(12, 22, 16, 0.42)',
          '--yarl__slide_captions_container_background': 'rgba(12, 22, 16, 0.48)',
          '--yarl__slide_title_font_weight': '400',
          '--yarl__slide_title_font_size': '14px',
        },
        container: {
          backgroundColor: 'rgba(12, 22, 16, 0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        },
        thumbnailsContainer: {
          backgroundColor: 'rgba(12, 22, 16, 0.42)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        },
      }}
      on={{
        view: ({ index }) => {
          if (activeIndex !== null && index !== activeIndex) {
            onIndexChange(index);
          }
        },
      }}
      labels={{
        Previous: 'Ảnh trước',
        Next: 'Ảnh tiếp theo',
        Close: 'Đóng (Esc)',
        'Zoom in': 'Phóng to',
        'Zoom out': 'Thu nhỏ',
        'Enter Fullscreen': 'Toàn màn hình',
        'Exit Fullscreen': 'Thoát toàn màn hình',
        Download: 'Tải ảnh xuống',
        'Show thumbnails': 'Hiện dải ảnh thu nhỏ',
        'Hide thumbnails': 'Ẩn dải ảnh thu nhỏ',
        'Show captions': 'Hiện thông tin tệp',
        'Hide captions': 'Ẩn thông tin tệp',
      }}
    />
  );
}
