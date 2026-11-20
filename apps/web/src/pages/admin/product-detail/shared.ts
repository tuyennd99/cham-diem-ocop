import type { AdminProductDetail, ProductStatus } from '@ocop/shared';
import { ATTACHMENT_TYPE } from '@/constants/consts';
import {
  ADMIN_DASHBOARD_STATUS_LABEL,
  REGISTRANT_PRODUCT_STATUS_LABEL,
} from '@/constants/product-status';

export type AdminDetailProduct = AdminProductDetail;

export interface EligibleManualJudge {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  verified: boolean;
  organizationUnit?: {
    id: string;
    code: string;
    name: string;
    managingAgencyId?: string | null;
    managingAgency?: { id: string; code: string; name: string } | null;
  } | null;
}

export const RESULT_HISTORY_ACTION_LABELS: Record<string, string> = {
  RECOMPUTE: 'Tính lại điểm tổng hợp',
  PUBLISHED: 'Công bố kết quả',
  REPUBLISHED: 'Công bố lại kết quả',
  PRODUCT_REOPENED: 'Mở lại hồ sơ',
  JUDGE_ADDED: 'Bổ sung giám khảo',
  JUDGE_RESTORED: 'Khôi phục phân công giám khảo',
  JUDGE_REMOVED: 'Gỡ giám khảo',
  EVALUATION_SUBMITTED: 'Nộp phiếu chấm',
  EVALUATION_REOPENED: 'Mở lại phiếu chấm',
};

export function formatStatusLabel(
  status: ProductStatus | string | null | undefined,
  isOwner = false,
): string {
  if (!status) return 'Mới tạo';
  if (isOwner) {
    return REGISTRANT_PRODUCT_STATUS_LABEL[status as ProductStatus] ?? status;
  }
  return ADMIN_DASHBOARD_STATUS_LABEL[status as ProductStatus] ?? status;
}

export function formatAttachmentType(
  type?: typeof ATTACHMENT_TYPE.IMAGE | typeof ATTACHMENT_TYPE.EVIDENCE,
): string {
  if (type === ATTACHMENT_TYPE.IMAGE) return 'Hình ảnh sản phẩm';
  if (type === ATTACHMENT_TYPE.EVIDENCE) return 'Tài liệu minh chứng';
  return 'Tệp đính kèm';
}

export function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  if (idx <= 0 || idx === fileName.length - 1) return 'FILE';
  return fileName
    .slice(idx + 1)
    .toUpperCase()
    .slice(0, 6);
}
