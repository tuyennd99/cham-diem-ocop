import type { Product, ProductPublicationState } from '@ocop/shared';
import type { Attachment, Category } from './product';

export interface PublicProductParams {
  page: number;
  limit: number;
  categoryId?: string;
  q?: string;
  approvedOnly?: boolean;
}

export type FeaturedProduct = Pick<
  Product,
  | 'id'
  | 'code'
  | 'codeNumber'
  | 'name'
  | 'description'
  | 'status'
  | 'approvedAt'
  | 'publicationState'
  | 'publishedAt'
  | 'finalScore'
  | 'starRating'
  | 'category'
  | 'attachments'
> & { category: Category };

export type PublicProduct = Omit<
  Product,
  'status' | 'description' | 'finalScore' | 'starRating' | 'createdAt' | 'category' | 'attachments'
> & {
  status: 'SUBMITTED' | 'APPROVED' | 'SCORING' | 'COMPLETED';
  approvedAt?: string | null;
  publicationState?: ProductPublicationState;
  publishedAt?: string | null;
  description: string | null;
  finalScore: number | null;
  starRating: number | null;
  createdAt: string;
  category: Category;
  attachments: Attachment[];
  videos?: Attachment[];
};
