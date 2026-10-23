import { BadRequestException } from '@nestjs/common';
import type {
  Locality,
  Product,
  ProductCategory,
  ProductGroup,
  User,
} from '@prisma/client';
import type {
  ProductApplicationForm,
  ProductRegistrationType,
  RegistrationSnapshotV1,
} from '@ocop/shared';
export type { RegistrationSnapshotV1 } from '@ocop/shared';
import { productRegistrationTypes } from '../constants/products';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateProductApplicationForm(
  value: unknown,
): ProductApplicationForm {
  const form = record(value);
  if (
    !form ||
    ![
      'entityName',
      'representativeName',
      'representativeTitle',
      'contactAddress',
      'provinceName',
    ].every((key) => text(form[key])) ||
    !(text(form.phone) || text(form.email)) ||
    !productRegistrationTypes.includes(
      form.registrationType as ProductRegistrationType,
    ) ||
    typeof form.sampleQuantity !== 'number' ||
    !Number.isInteger(form.sampleQuantity) ||
    form.sampleQuantity < 1 ||
    form.sampleQuantity > 100000 ||
    typeof form.assessmentYear !== 'number' ||
    !Number.isInteger(form.assessmentYear) ||
    form.assessmentYear < 2020 ||
    form.assessmentYear > 2100 ||
    form.declarationAccepted !== true
  ) {
    throw new BadRequestException(
      'Complete all required application fields and accept the declaration before submitting',
    );
  }

  return {
    entityName: form.entityName as string,
    representativeName: form.representativeName as string,
    representativeTitle: form.representativeTitle as string,
    contactAddress: form.contactAddress as string,
    provinceName: form.provinceName as string,
    ...(text(form.phone) ? { phone: form.phone } : {}),
    ...(text(form.email) ? { email: form.email } : {}),
    registrationType: form.registrationType as ProductRegistrationType,
    sampleQuantity: form.sampleQuantity,
    assessmentYear: form.assessmentYear,
    declarationAccepted: true,
  };
}

export function buildRegistrationSnapshot(input: {
  submittedAt: Date;
  product: Pick<Product, 'id' | 'name' | 'description' | 'formData'>;
  registrant: Pick<User, 'id' | 'fullName' | 'email' | 'phone'>;
  category: Pick<
    ProductCategory,
    'id' | 'name' | 'classificationGroup' | 'classificationSubgroup'
  >;
  group: Pick<ProductGroup, 'id' | 'code' | 'name'>;
  locality: Pick<Locality, 'id' | 'code' | 'name' | 'type' | 'provinceName'>;
}): RegistrationSnapshotV1 {
  return {
    version: 1,
    submittedAt: input.submittedAt.toISOString(),
    product: {
      id: input.product.id,
      name: input.product.name,
      description: input.product.description,
    },
    registrant: {
      id: input.registrant.id,
      fullName: input.registrant.fullName,
      email: input.registrant.email,
      phone: input.registrant.phone,
    },
    category: {
      id: input.category.id,
      name: input.category.name,
      classificationGroup: input.category.classificationGroup,
      classificationSubgroup: input.category.classificationSubgroup,
      group: {
        id: input.group.id,
        code: input.group.code,
        name: input.group.name,
      },
    },
    locality: {
      id: input.locality.id,
      code: input.locality.code,
      name: input.locality.name,
      type: input.locality.type,
      provinceName: input.locality.provinceName,
    },
    formData: validateProductApplicationForm(input.product.formData),
  };
}
