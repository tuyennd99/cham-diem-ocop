import type { Product as SharedProduct, ProductApplicationForm, ProductRegistrationType } from "@ocop/shared";
import type { Category as ProductCategoryView, ProductAttachmentRecord } from "./product";

export type RegistrantCategory = ProductCategoryView & { classificationGroup: string; classificationSubgroup: string | null };

export type RegistrantProduct = Omit<SharedProduct, "formData" | "finalScore" | "starRating" | "submittedAt" | "updatedAt" | "category" | "attachments"> & {
  formData: Record<string, unknown>;
  finalScore: number | null;
  starRating: number | null;
  submittedAt: string | null;
  updatedAt: string;
  category: ProductCategoryView & {
    classificationGroup: string;
    classificationSubgroup: string | null;
    isActive: boolean;
    group: { isActive: boolean };
    criteriaSet: { isActive: boolean } | null;
  };
  attachments: ProductAttachmentRecord[];
};

export type RegistrantFormData = Omit<ProductApplicationForm, "sampleQuantity" | "assessmentYear" | "registrationType"> & {
  registrationType: ProductRegistrationType | "";
  sampleQuantity: string;
  assessmentYear: string;
};

export interface ProductWriteInput {
  name: string;
  categoryId: string;
  description?: string | null;
  formData: Partial<ProductApplicationForm>;
}
