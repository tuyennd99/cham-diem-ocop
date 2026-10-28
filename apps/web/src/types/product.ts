import type { Criterion, ProductAttachment, ProductCategory } from '@ocop/shared';

export type Category = ProductCategory;
export type Attachment = Pick<ProductAttachment, 'id' | 'fileName'>;
export type ProductAttachmentRecord = ProductAttachment & {
  type: 'IMAGE' | 'EVIDENCE';
  createdAt: string;
};
export type CategoryRecord = Category & {
  criteriaSet?: { criteria: Criterion[] } | null;
};
