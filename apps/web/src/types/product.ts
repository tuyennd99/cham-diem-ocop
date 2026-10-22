import type { Criterion, ProductAttachment, ProductCategory } from "@ocop/shared";

export type Category = ProductCategory & { groupName: string };
export type Attachment = Pick<ProductAttachment, "id" | "fileName">;
export type ProductAttachmentRecord = ProductAttachment & { type: "IMAGE" | "EVIDENCE"; createdAt: string };
export type CategoryRecord = Category & {
  groupCode: string;
  classificationGroup: string;
  classificationSubgroup: string | null;
  criteriaSet?: { criteria: Criterion[] } | null;
};
