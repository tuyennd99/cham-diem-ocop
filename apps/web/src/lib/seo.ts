import {
  isSeoEligibleProduct,
  SEO_ELIGIBLE_PRODUCT_STATUSES,
  type SeoEligibleProductStatus,
} from '@ocop/shared';
import { publicAttachmentUrl } from '../constants/api';

export { isSeoEligibleProduct, SEO_ELIGIBLE_PRODUCT_STATUSES, type SeoEligibleProductStatus };

export const DEFAULT_SITE_TITLE = 'OCOP Đánh Giá — Đăng ký, chấm điểm và xếp hạng sản phẩm';
export const DEFAULT_SITE_DESCRIPTION =
  'Hệ thống đăng ký, chấm điểm và xếp hạng sản phẩm OCOP. Tra cứu sản phẩm đã được duyệt, theo dõi hồ sơ và kết quả đánh giá.';
export const DEFAULT_OG_IMAGE_PATH = '/og-default.png';

export const PUBLIC_CATALOG_TITLE = 'Tra cứu sản phẩm OCOP — Danh sách sản phẩm đã duyệt';
export const PUBLIC_CATALOG_DESCRIPTION =
  'Danh sách sản phẩm OCOP đã được Chủ trì duyệt. Tìm kiếm, lọc theo danh mục và xem thông tin chi tiết từng sản phẩm.';

function normalizeOrigin(origin: string | undefined | null): string | null {
  if (!origin) return null;
  const trimmed = origin.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function resolvePublicOrigin(requestOrigin?: string | null): string {
  const envOrigin =
    (typeof process !== 'undefined'
      ? process.env.PUBLIC_ORIGIN || process.env.VITE_PUBLIC_ORIGIN
      : undefined) || import.meta.env?.VITE_PUBLIC_ORIGIN;
  const configured = normalizeOrigin(envOrigin);
  if (configured) return configured;

  const fromRequest = normalizeOrigin(requestOrigin);
  if (fromRequest) return fromRequest;

  if (
    typeof window !== 'undefined' &&
    window.location?.origin &&
    window.location.origin !== 'null'
  ) {
    return window.location.origin;
  }

  return 'http://localhost:5173';
}

export function buildCanonicalUrl(path: string, requestOrigin?: string | null): string {
  const origin = resolvePublicOrigin(requestOrigin);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, `${origin}/`).toString();
}

export function buildCatalogCanonicalUrl(
  search: { page?: number } = {},
  requestOrigin?: string | null,
): string {
  const page = typeof search.page === 'number' && search.page > 1 ? search.page : 1;
  const path = page > 1 ? `/products?page=${page}` : '/products';
  return buildCanonicalUrl(path, requestOrigin);
}

export function isCatalogSearchFiltered(
  search: { q?: string; categoryId?: string; limit?: number },
  defaultLimit = 10,
): boolean {
  return Boolean(
    (search.q && search.q.trim().length > 0) ||
    (search.categoryId && search.categoryId.trim().length > 0) ||
    (search.limit !== undefined && search.limit !== defaultLimit),
  );
}

export function buildPublicProductTitle(product: { name: string }): string {
  return `${product.name} — OCOP Đánh Giá`;
}

export function buildPublicProductDescription(product: {
  name: string;
  description?: string | null;
  category?: { name?: string | null } | null;
}): string {
  const trimmedDescription = product.description?.trim();
  if (trimmedDescription) {
    return trimmedDescription;
  }
  const categoryName = product.category?.name?.trim();
  if (categoryName) {
    return `Thông tin sản phẩm OCOP ${product.name} thuộc nhóm ${categoryName}.`;
  }
  return `Thông tin sản phẩm OCOP ${product.name}.`;
}

export function buildPublicProductCanonicalUrl(
  productId: string,
  requestOrigin?: string | null,
): string {
  return buildCanonicalUrl(`/products/${encodeURIComponent(productId)}`, requestOrigin);
}

export function buildPublicProductOgImageUrl(
  product: {
    id: string;
    attachments?: ReadonlyArray<{ id: string }> | null;
  },
  requestOrigin?: string | null,
): string {
  const origin = resolvePublicOrigin(requestOrigin);
  const firstAttachment = product.attachments?.[0];
  if (firstAttachment?.id) {
    return new URL(publicAttachmentUrl(product.id, firstAttachment.id), `${origin}/`).toString();
  }
  return buildCanonicalUrl(DEFAULT_OG_IMAGE_PATH, requestOrigin);
}
