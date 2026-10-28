import { BadRequestException } from '@nestjs/common';
import { buildRegistrationSnapshot } from './registration-snapshot';

describe('buildRegistrationSnapshot', () => {
  const product = {
    id: 'product-1',
    name: 'Product',
    description: null,
    formData: {
      entityName: 'Entity',
      representativeName: 'Representative',
      representativeTitle: 'Director',
      contactAddress: 'Address',
      provinceName: 'Province',
      email: 'contact@example.invalid',
      registrationType: 'FIRST',
      sampleQuantity: 1,
      assessmentYear: 2026,
      declarationAccepted: true,
      privateToken: 'must not be copied',
    },
  };

  const input = {
    submittedAt: new Date('2026-10-23T05:00:00.000Z'),
    product,
    registrant: {
      id: 'registrant-1',
      fullName: 'Registrant',
      email: 'registrant@example.invalid',
      phone: null,
      password: 'must not be copied',
    },
    category: {
      id: 'category-1',
      name: 'Category',
    },
    locality: {
      id: 'locality-1',
      code: 'L1',
      name: 'Locality',
      type: 'COMMUNE' as const,
      provinceName: 'Province',
    },
  };

  it('builds a versioned allowlisted snapshot with normalized submission time', () => {
    const snapshot = buildRegistrationSnapshot(input);

    expect(snapshot).toEqual({
      version: 2,
      submittedAt: '2026-10-23T05:00:00.000Z',
      product: { id: 'product-1', name: 'Product', description: null },
      registrant: {
        id: 'registrant-1',
        fullName: 'Registrant',
        email: 'registrant@example.invalid',
        phone: null,
      },
      category: {
        id: 'category-1',
        name: 'Category',
      },
      locality: {
        id: 'locality-1',
        code: 'L1',
        name: 'Locality',
        type: 'COMMUNE',
        provinceName: 'Province',
      },
      formData: {
        entityName: 'Entity',
        representativeName: 'Representative',
        representativeTitle: 'Director',
        contactAddress: 'Address',
        provinceName: 'Province',
        email: 'contact@example.invalid',
        registrationType: 'FIRST',
        sampleQuantity: 1,
        assessmentYear: 2026,
        declarationAccepted: true,
      },
    });
  });

  it.each([
    [{ ...product.formData, entityName: ' ' }],
    [{ ...product.formData, phone: '', email: '' }],
    [{ ...product.formData, registrationType: 'UNKNOWN' }],
    [{ ...product.formData, sampleQuantity: 0 }],
    [{ ...product.formData, assessmentYear: 2101 }],
    [{ ...product.formData, declarationAccepted: false }],
  ])('rejects an incomplete or invalid application form', (formData) => {
    expect(() =>
      buildRegistrationSnapshot({
        ...input,
        product: { ...product, formData },
      }),
    ).toThrow(BadRequestException);
  });
});
