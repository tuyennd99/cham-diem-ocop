import type { Criterion, Evaluation, Product, ProductAttachment } from "@ocop/shared";
import type { Attachment, Category } from "./product";

export type QueueProduct = Pick<Product, "id" | "name" | "description" | "status" | "createdAt" | "category"> & {
  createdAt: string;
  category: Category;
  attachments: Attachment[];
  evaluations: { status: string; total: number | null }[];
};

export interface EvaluationData {
  product: Pick<Product, "id" | "name" | "description"> & {
    formData: Record<string, unknown>;
    category: Pick<Category, "id" | "name" | "groupName">;
    attachments: Required<Pick<ProductAttachment, "id" | "fileName" | "type">>[];
  };
  criteria: Criterion[];
  evaluation: Evaluation;
}

