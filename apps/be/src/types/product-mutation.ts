import type { RequestMeta } from './auth';

export type ProductMutationActor =
  | { kind: 'OWNER'; id: string }
  | { kind: 'MANAGER'; id: string; reason: string; meta: RequestMeta };
