import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getFirstInvalidProductDraftElementId,
  getProductDraftFieldErrors,
  getProductSubmitValidationIssues,
  getSavedProductSubmitIssues,
  getUnsavedPrefilledDraftFields,
  saveProductDraft,
  validateProductDirectSubmitInput,
  validateProductDraftInput,
  type ProductDraftCommands,
} from '../src/lib/save-product-draft';
import type { RegistrantProduct } from '../src/types/registrant';

function makeProduct(overrides: Partial<RegistrantProduct> = {}): RegistrantProduct {
  return {
    id: 'draft-33',
    name: 'Chè Shan Tuyết',
    localityId: null,
    category: { id: 'cat-1', name: 'Đồ uống', isActive: true, criteriaSet: { isActive: true } },
    status: 'DRAFT',
    attachments: [],
    formData: {},
    ...overrides,
  } as unknown as RegistrantProduct;
}

function makeCommands(overrides: Partial<ProductDraftCommands> = {}): ProductDraftCommands {
  return {
    create: async (payload) => ({ data: makeProduct({ formData: payload.formData }) }),
    update: async (id, payload) => ({ data: makeProduct({ id, formData: payload.formData }) }),
    upload: async () => {
      throw new Error('unexpected upload');
    },
    detail: async () => ({ data: makeProduct() }),
    ...overrides,
  };
}

const fullValidInput = {
  name: 'Chè Shan Tuyết',
  categoryId: 'cat-1',
  provinceName: 'Tỉnh Tuyên Quang',
  localityName: 'Xã Hồng Thái',
  entityName: 'HTX Chè Hồng Thái',
  representativeName: 'Nguyễn Văn A',
  representativeTitle: 'Giám đốc',
  contactAddress: 'Thôn Khau Tràng, Xã Hồng Thái',
  phone: '0912345678',
  email: '',
  registrationType: 'FIRST',
  sampleQuantity: '1',
  assessmentYear: '2026',
  declarationAccepted: true,
};

describe('product draft and submit validation sync (#35)', () => {
  it('requires all mandatory fields when saving a draft and maps the first invalid element in DOM order', async () => {
    const incompleteDraft = {
      name: 'Bản nháp thiếu thông tin',
      categoryId: 'cat-1',
      provinceName: '',
      localityId: '',
      localityName: '',
      entityName: '   ',
      representativeName: '',
      representativeTitle: '',
      contactAddress: '',
      phone: '   ',
      email: '   ',
      registrationType: '',
      sampleQuantity: '0',
      assessmentYear: '2026',
      declarationAccepted: true,
    };

    const draftErrors = getProductDraftFieldErrors(incompleteDraft, { intent: 'draft' });
    assert.ok(draftErrors.provinceName?.includes('lưu bản nháp'));
    assert.ok(draftErrors.localityId?.includes('lưu bản nháp'));
    assert.ok(draftErrors.entityName?.includes('lưu bản nháp'));
    assert.ok(draftErrors.phone?.includes('số điện thoại hoặc email'));
    assert.ok(draftErrors.sampleQuantity?.includes('1 đến 100000'));
    assert.equal(getFirstInvalidProductDraftElementId(draftErrors), 'product-draft-1');
    assert.throws(() => validateProductDraftInput(incompleteDraft), /Tỉnh\/Thành phố/);

    let savedPayload: unknown = null;
    const result = await saveProductDraft({
      payload: {
        name: fullValidInput.name,
        categoryId: fullValidInput.categoryId,
        localityId: 'loc-1',
        formData: {
          entityName: fullValidInput.entityName,
          representativeName: fullValidInput.representativeName,
          representativeTitle: fullValidInput.representativeTitle,
          contactAddress: fullValidInput.contactAddress,
          provinceName: fullValidInput.provinceName,
          localityName: fullValidInput.localityName,
          phone: fullValidInput.phone,
          registrationType: 'FIRST',
          sampleQuantity: 1,
          assessmentYear: 2026,
          declarationAccepted: true,
        },
      },
      files: [],
      submitAfterSave: false,
      commands: makeCommands({
        create: async (payload) => {
          savedPayload = payload;
          return { data: makeProduct({ name: payload.name, formData: payload.formData }) };
        },
      }),
    });

    assert.equal(result.kind, 'saved');
    assert.ok(savedPayload);
  });

  it('reports every missing or invalid submit field at once', () => {
    const issues = getProductSubmitValidationIssues({
      name: '',
      categoryId: '',
      provinceName: '',
      localityId: '',
      localityName: '',
      entityName: '  ',
      representativeName: '',
      representativeTitle: '',
      contactAddress: '',
      phone: '',
      email: '',
      registrationType: '',
      sampleQuantity: '',
      assessmentYear: '',
      declarationAccepted: false,
    });

    assert.equal(issues.length, 13);
    assert.ok(issues.some((m) => m.includes('tên sản phẩm')));
    assert.ok(issues.some((m) => m.includes('danh mục')));
    assert.ok(issues.some((m) => m.includes('Tỉnh/Thành phố')));
    assert.ok(issues.some((m) => m.includes('Xã/Phường')));
    assert.ok(issues.some((m) => m.includes('đơn vị sản xuất')));
    assert.ok(issues.some((m) => m.includes('người đại diện')));
    assert.ok(issues.some((m) => m.includes('chức vụ')));
    assert.ok(issues.some((m) => m.includes('địa chỉ liên hệ')));
    assert.ok(issues.some((m) => m.includes('số điện thoại hoặc email')));
    assert.ok(issues.some((m) => m.includes('lần đăng ký đánh giá')));
    assert.ok(issues.some((m) => m.includes('Số lượng mẫu')));
    assert.ok(issues.some((m) => m.includes('Năm đánh giá')));
    assert.ok(issues.some((m) => m.includes('xác nhận cam kết')));
  });

  it('requires at least phone or email without requiring both, and enforces integer ranges', () => {
    assert.deepEqual(
      getProductSubmitValidationIssues({ ...fullValidInput, phone: '0912345678', email: '' }),
      [],
    );
    assert.deepEqual(
      getProductSubmitValidationIssues({ ...fullValidInput, phone: '', email: 'a@b.vn' }),
      [],
    );
    assert.equal(
      getProductSubmitValidationIssues({ ...fullValidInput, phone: '', email: '' }).length,
      1,
    );

    assert.deepEqual(
      getProductSubmitValidationIssues({
        ...fullValidInput,
        sampleQuantity: '100000',
        assessmentYear: '2020',
      }),
      [],
    );
    assert.deepEqual(
      getProductSubmitValidationIssues({
        ...fullValidInput,
        sampleQuantity: '1',
        assessmentYear: '2100',
      }),
      [],
    );

    for (const badQty of ['', '0', '-1', '1.5', '100001']) {
      assert.throws(
        () => validateProductDirectSubmitInput({ ...fullValidInput, sampleQuantity: badQty }),
        /1 đến 100000/,
      );
    }
    for (const badYear of ['', '2019', '2101', '2026.5']) {
      assert.throws(
        () => validateProductDirectSubmitInput({ ...fullValidInput, assessmentYear: badYear }),
        /2020 đến 2100/,
      );
    }
  });

  it('catches unsaved auto-filled fields when validating saved product for detail/list submit', () => {
    const unsavedDraft = makeProduct({
      localityId: 'loc-1',
      formData: {
        entityName: 'HTX Trà',
        representativeName: 'Nguyễn Văn A',
        representativeTitle: 'Giám đốc',
        contactAddress: 'Xã Hồng Thái',
        registrationType: 'FIRST',
        declarationAccepted: true,
        // provinceName, phone/email, sampleQuantity, assessmentYear NOT saved yet in DB
      },
    });

    const savedIssues = getSavedProductSubmitIssues(unsavedDraft);
    assert.equal(savedIssues.length, 4);
    assert.ok(savedIssues.some((m) => m.includes('Tỉnh/Thành phố')));
    assert.ok(savedIssues.some((m) => m.includes('số điện thoại hoặc email')));
    assert.ok(savedIssues.some((m) => m.includes('Số lượng mẫu')));
    assert.ok(savedIssues.some((m) => m.includes('Năm đánh giá')));

    const unsavedPrefills = getUnsavedPrefilledDraftFields(
      unsavedDraft.formData,
      {
        provinceName: 'Tỉnh Tuyên Quang',
        localityName: 'Xã Hồng Thái',
        email: 'account@ocop.vn',
        assessmentYear: '2026',
      },
      unsavedDraft.localityId,
    );
    assert.deepEqual(unsavedPrefills, [
      'Tỉnh/Thành phố',
      'Thông tin liên hệ (SĐT/Email)',
      'Năm đăng ký',
    ]);

    const savedComplete = makeProduct({
      localityId: 'loc-1',
      formData: {
        ...unsavedDraft.formData,
        provinceName: 'Tỉnh Tuyên Quang',
        email: 'account@ocop.vn',
        sampleQuantity: 1,
        assessmentYear: 2026,
      },
    });
    assert.deepEqual(getSavedProductSubmitIssues(savedComplete), []);
    assert.deepEqual(
      getUnsavedPrefilledDraftFields(
        savedComplete.formData,
        {
          provinceName: 'Tỉnh Tuyên Quang',
          localityName: 'Xã Hồng Thái',
          email: 'account@ocop.vn',
          assessmentYear: '2026',
        },
        savedComplete.localityId,
      ),
      [],
    );
  });
});
