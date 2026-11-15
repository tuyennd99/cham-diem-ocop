import { PRODUCT_MUTATION_ACTOR_KIND } from '../constants/products';
import type { RequestMeta } from './auth';

export type ProductMutationActor =
  | { kind: typeof PRODUCT_MUTATION_ACTOR_KIND.OWNER; id: string }
  | {
      kind: typeof PRODUCT_MUTATION_ACTOR_KIND.MANAGER;
      id: string;
      reason: string;
      meta: RequestMeta;
    };
