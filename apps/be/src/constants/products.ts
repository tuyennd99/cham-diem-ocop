import type { ProductRegistrationType } from '@ocop/shared';

export const productRegistrationTypes = [
  'FIRST',
  'UPGRADE',
  'REASSESSMENT',
] as const satisfies readonly ProductRegistrationType[];

export const MAX_FILES_PER_PRODUCT = 5;
export const MAX_VIDEOS_PER_PRODUCT = 1;
export const MAX_ATTACHMENTS_PER_PRODUCT = MAX_FILES_PER_PRODUCT + MAX_VIDEOS_PER_PRODUCT;
