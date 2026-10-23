import type { RegistrantCategory, RegistrantProduct } from '../types/registrant';

export type ProductEditorCategory = RegistrantCategory & { unavailable?: boolean };

export function productEditorCategories(
  activeCategories: RegistrantCategory[],
  product: (Pick<RegistrantProduct, 'status'> & { category: RegistrantCategory }) | null,
): ProductEditorCategory[] {
  if (
    !product ||
    product.status !== 'DRAFT' ||
    activeCategories.some(({ id }) => id === product.category.id)
  )
    return activeCategories;

  return [
    ...activeCategories.filter(({ id }) => id !== product.category.id),
    { ...product.category, unavailable: true },
  ];
}
