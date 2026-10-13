export type ProductCategory = "food" | "drink" | "herbal";
export type DossierCategory = "all" | ProductCategory;
export type DossierStatus = "ranked" | "evaluating" | "received";
export type StatusFilter = "all" | DossierStatus;

export interface DossierRecord {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  categoryLabel: string;
  origin: string;
  applicant: string;
  status: DossierStatus;
  statusLabel: string;
  stage: string;
  updated: string;
  rating: number | null;
  image: string;
  width: number;
  height: number;
  alt: string;
  note: string;
}
