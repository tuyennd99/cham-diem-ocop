import { PRODUCT_STATUS } from '@ocop/shared';
import type { RegistrantCategory, RegistrantProduct } from '../types/registrant';

export type ProductEditorCategory = RegistrantCategory & { unavailable?: boolean };

export function productEditorCategories(
  activeCategories: RegistrantCategory[],
  product: (Pick<RegistrantProduct, 'status'> & { category: RegistrantCategory }) | null,
): ProductEditorCategory[] {
  if (
    !product ||
    (product.status !== PRODUCT_STATUS.DRAFT && product.status !== PRODUCT_STATUS.RETURNED) ||
    activeCategories.some(({ id }) => id === product.category.id)
  )
    return activeCategories;

  return [
    ...activeCategories.filter(({ id }) => id !== product.category.id),
    { ...product.category, unavailable: true },
  ];
}
