import type { ProductStatus } from "@ocop/shared";

export const PUBLIC_PRODUCT_STATUS_LABEL = {
  SUBMITTED: "Đã tiếp nhận",
  SCORING: "Đang đánh giá",
  COMPLETED: "Đã xếp hạng",
} as const;

export const PUBLIC_PRODUCT_STATUS_TONE = {
  SUBMITTED: "status-received",
  SCORING: "status-evaluating",
  COMPLETED: "status-ranked",
} as const;

export const REGISTRANT_PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã nộp",
  SCORING: "Đang đánh giá",
  COMPLETED: "Đã hoàn tất",
};

export const ADMIN_DASHBOARD_STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã nộp",
  SCORING: "Đang chấm",
  COMPLETED: "Hoàn tất",
};
