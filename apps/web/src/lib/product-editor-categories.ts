import type { RegistrantCategory, RegistrantProduct } from "../types/registrant";

export type ProductEditorCategory = RegistrantCategory & { unavailable?: boolean };

export function productEditorCategories(
  activeCategories: RegistrantCategory[],
  product: Pick<RegistrantProduct, "status" | "category"> | null,
): ProductEditorCategory[] {
  if (
    !product || product.status !== "DRAFT" ||
    (product.category.isActive && product.category.group.isActive && product.category.criteriaSet?.isActive)
  ) return activeCategories;

  return [
    ...activeCategories.filter(({ id }) => id !== product.category.id),
    { ...product.category, unavailable: true },
  ];
}
