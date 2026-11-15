import {
  ATTACHMENT_TYPE,
  EVALUATION_STATUS,
  PRODUCT_PUBLICATION_STATE,
  PRODUCT_REGISTRATION_TYPE,
  PRODUCT_STATUS,
  type ProductStatus,
} from '@ocop/shared';

export {
  ATTACHMENT_TYPE,
  EVALUATION_STATUS,
  PRODUCT_PUBLICATION_STATE,
  PRODUCT_REGISTRATION_TYPE,
  PRODUCT_STATUS,
};

export const PUBLIC_PRODUCT_STATUS_LABEL = {
  SUBMITTED: 'Đã tiếp nhận',
  APPROVED: 'Đã duyệt',
  SCORING: 'Đang đánh giá',
  COMPLETED: 'Đã xếp hạng',
} as const;

export const PUBLIC_PRODUCT_STATUS_TONE = {
  SUBMITTED: 'status-received',
  APPROVED: 'status-approved',
  SCORING: 'status-evaluating',
  COMPLETED: 'status-ranked',
} as const;

export const REGISTRANT_PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: 'Bản nháp',
  SUBMITTED: 'Chờ duyệt',
  RETURNED: 'Bị trả lại',
  APPROVED: 'Đã duyệt',
  SCORING: 'Đang đánh giá',
  COMPLETED: 'Đã hoàn tất',
};

export const ADMIN_DASHBOARD_STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: 'Bản nháp',
  SUBMITTED: 'Chờ duyệt',
  RETURNED: 'Đã trả lại',
  APPROVED: 'Đã duyệt',
  SCORING: 'Đang chấm',
  COMPLETED: 'Hoàn tất',
};

export const PRODUCT_STATUS_TONE: Record<ProductStatus, string> = {
  DRAFT: 'status-badge status-draft',
  SUBMITTED: 'status-badge status-submitted',
  RETURNED: 'status-badge status-returned',
  APPROVED: 'status-badge status-approved',
  SCORING: 'status-badge status-scoring',
  COMPLETED: 'status-badge status-completed',
};

export const EVALUATION_STATUS_TONE = {
  IN_PROGRESS: 'status-badge status-scoring',
  SUBMITTED: 'status-badge status-completed',
  EXCLUDED: 'status-badge status-draft',
} as const;
