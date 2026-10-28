import type {
  LocalityRecord,
  ProductApplicationForm,
  ProductRegistrationType,
  RegistrationSnapshot,
  Product as SharedProduct,
} from '@ocop/shared';
import type { ProductAttachmentRecord, Category as ProductCategoryView } from './product';

export type RegistrantCategory = ProductCategoryView;

export type RegistrantProduct = Omit<
  SharedProduct,
  | 'formData'
  | 'finalScore'
  | 'starRating'
  | 'submittedAt'
  | 'updatedAt'
  | 'category'
  | 'attachments'
  | 'createdAt'
> & {
  createdById: string | null;
  completedAt: string | null;
  localityId: string | null;
  locality: LocalityRecord | null;
  registrationSnapshot: RegistrationSnapshot | null;
  formData: Record<string, unknown>;
  finalScore: number | null;
  starRating: number | null;
  submittedAt: string | null;
  updatedAt: string;
  category: ProductCategoryView & {
    isActive: boolean;
    criteriaSet: { isActive: boolean } | null;
  };
  attachments: ProductAttachmentRecord[];
};

export type RegistrantFormData = Omit<
  ProductApplicationForm,
  'sampleQuantity' | 'assessmentYear' | 'registrationType'
> & {
  registrationType: ProductRegistrationType | '';
  sampleQuantity: string;
  assessmentYear: string;
};

export interface ProductWriteInput {
  name: string;
  categoryId: string;
  localityId?: string | null;
  description?: string | null;
  formData: Partial<ProductApplicationForm>;
}
