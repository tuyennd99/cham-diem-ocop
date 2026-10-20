import type { ProductAttachment, ProductCategory } from "@ocop/shared";

export type Category = ProductCategory & { groupName: string };
export type Attachment = Pick<ProductAttachment, "id" | "fileName">;
export type ProductAttachmentRecord = ProductAttachment & { type: "IMAGE" | "EVIDENCE"; createdAt: string };
