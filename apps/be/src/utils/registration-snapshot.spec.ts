import { BadRequestException } from '@nestjs/common';
import {
  buildRegistrationSnapshot,
  mergeProductApplicationFormData,
  validateProductApplicationForm,
  validateProductDraftWrite,
} from './registration-snapshot';

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

  it.each([
    ['entityName', '', 'thiếu tên đơn vị sản xuất'],
    ['representativeName', '', 'thiếu người đại diện'],
    ['representativeTitle', '', 'thiếu chức vụ người đại diện'],
    ['contactAddress', '', 'thiếu địa chỉ liên hệ'],
    ['provinceName', '', 'thiếu tỉnh/thành phố'],
    ['email', '', 'thiếu số điện thoại hoặc email liên hệ'],
    ['registrationType', 'UNKNOWN', 'chọn lần đăng ký đánh giá hợp lệ'],
    ['sampleQuantity', 0, 'số lượng mẫu phải là số nguyên từ 1 đến 100000'],
    ['assessmentYear', 2101, 'năm đăng ký phải là số nguyên từ 2020 đến 2100'],
    ['declarationAccepted', false, 'chưa xác nhận cam kết hồ sơ'],
  ])('names the invalid field %s', (key, value, message) => {
    expect(() =>
      validateProductApplicationForm({ ...product.formData, [key]: value }),
    ).toThrow(message);
  });

  it('reports all invalid fields without echoing saved private values', () => {
    try {
      validateProductApplicationForm({
        ...product.formData,
        entityName: '',
        representativeTitle: ' ',
        email: '',
        declarationAccepted: false,
      });
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const message = (error as BadRequestException).message;
      expect(message).toContain('thiếu tên đơn vị sản xuất');
      expect(message).toContain('thiếu chức vụ người đại diện');
      expect(message).toContain('thiếu số điện thoại hoặc email liên hệ');
      expect(message).toContain('chưa xác nhận cam kết hồ sơ');
      expect(message).not.toContain('must not be copied');
      expect(message).not.toContain('Representative');
    }
  });

  it('accepts a phone instead of email and valid numeric boundaries', () => {
    expect(
      validateProductApplicationForm({
        ...product.formData,
        email: '',
        phone: '0123456789',
        sampleQuantity: 100000,
        assessmentYear: 2020,
      }),
    ).toMatchObject({
      phone: '0123456789',
      sampleQuantity: 100000,
      assessmentYear: 2020,
    });
  });

  describe('validateProductDraftWrite & mergeProductApplicationFormData', () => {
    const validDraft = {
      name: 'Trà Shan Tuyết',
      categoryId: 'cat-1',
      localityId: 'loc-1',
      formData: {
        ...product.formData,
        localityName: 'Xã Bạch Đằng',
      },
    };

    it('rejects draft writes missing name, categoryId, locality, or mandatory form fields', () => {
      expect(() =>
        validateProductDraftWrite({ ...validDraft, name: '   ' }),
      ).toThrow('thiếu tên sản phẩm');
      expect(() =>
        validateProductDraftWrite({ ...validDraft, categoryId: ' ' }),
      ).toThrow('thiếu danh mục sản phẩm');
      expect(() =>
        validateProductDraftWrite({
          ...validDraft,
          localityId: null,
          formData: { ...product.formData, localityName: '  ' },
        }),
      ).toThrow('thiếu địa bàn hành chính (xã/phường)');
      expect(() =>
        validateProductDraftWrite({
          ...validDraft,
          formData: { ...validDraft.formData, phone: '   ', email: '   ' },
        }),
      ).toThrow('thiếu số điện thoại hoặc email liên hệ');
      expect(() =>
        validateProductDraftWrite({
          ...validDraft,
          formData: { ...validDraft.formData, sampleQuantity: 0 },
        }),
      ).toThrow('số lượng mẫu phải là số nguyên từ 1 đến 100000');
      expect(() =>
        validateProductDraftWrite({
          ...validDraft,
          formData: { ...validDraft.formData, assessmentYear: 2019 },
        }),
      ).toThrow('năm đăng ký phải là số nguyên từ 2020 đến 2100');
      expect(() =>
        validateProductDraftWrite({
          ...validDraft,
          formData: { ...validDraft.formData, declarationAccepted: false },
        }),
      ).toThrow('chưa xác nhận cam kết hồ sơ');
    });

    it('merges partial formData updates and validates the merged draft state', () => {
      const merged = mergeProductApplicationFormData(validDraft.formData, {
        contactAddress: '  Số 10 Phố Mới  ',
        phone: '0987654321',
        email: '   ',
      });
      const validated = validateProductDraftWrite({
        ...validDraft,
        formData: merged,
      });
      expect(validated.formData).toMatchObject({
        entityName: 'Entity',
        contactAddress: 'Số 10 Phố Mới',
        phone: '0987654321',
      });
      expect(validated.formData.email).toBeUndefined();
    });
  });
});
