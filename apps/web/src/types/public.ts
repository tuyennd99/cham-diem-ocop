import type { Product } from "@ocop/shared";
import type { Attachment, Category } from "./product";

export type FeaturedProduct = Pick<Product, "id" | "name" | "description" | "status" | "finalScore" | "starRating" | "category" | "attachments"> & { category: Category };

export type PublicProduct = Omit<Product, "status" | "description" | "finalScore" | "starRating" | "createdAt" | "category" | "attachments"> & {
  status: "SUBMITTED" | "SCORING" | "COMPLETED";
  description: string | null;
  finalScore: number | null;
  starRating: number | null;
  createdAt: string;
  category: Category;
  attachments: Attachment[];
};
