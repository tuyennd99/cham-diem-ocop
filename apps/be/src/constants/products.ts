import type { ProductRegistrationType } from '@ocop/shared';

export const productRegistrationTypes = [
  'FIRST',
  'UPGRADE',
  'REASSESSMENT',
] as const satisfies readonly ProductRegistrationType[];

export const MAX_ATTACHMENTS_PER_PRODUCT = 20;
