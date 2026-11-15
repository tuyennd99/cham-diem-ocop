import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FormApi } from '@tanstack/react-form';
import { ApiError } from '../src/lib/api-error';
import {
  applyRegistrationUnitToEditorValues,
  EMPTY_REGISTRATION_UNIT_FORM,
  hasEnteredUnitDataToConfirm,
  QUICK_SAVE_UNIT_OUTCOME,
  quickSaveRegistrationUnitAfterDraft,
  registrationUnitToFormValues,
  resolveWardLocalityCode,
  toRegistrationUnitWriteInput,
  validateRegistrationUnitInput,
} from '../src/lib/registration-units';
import {
  saveProductDraft,
  type ProductDraftCommands,
} from '../src/lib/save-product-draft';
import type { ProductAttachmentRecord } from '../src/types/product';
import type {
  ProductWriteInput,
  RegistrantProduct,
  RegistrationUnitRecord,
} from '../src/types/registrant';

const sampleSavedUnit: RegistrationUnitRecord = {
  id: 'unit-1',
  entityName: 'HTX Nông nghiệp Tân Cương',
  representativeName: 'Nguyễn Văn A',
  representativeTitle: 'Giám đốc',
  contactAddress: 'Xóm Hồng Thái 2, xã Tân Cương',
  provinceName: 'Tỉnh Thái Nguyên',
  localityName: 'Xã Tân Cương',
  localityCode: 'XP19001',
  phone: '0912345678',
  createdAt: '2026-11-09T00:00:00.000Z',
  updatedAt: '2026-11-09T00:00:00.000Z',
};

function makeProduct(overrides: Partial<RegistrantProduct> = {}): RegistrantProduct {
  return {
    id: 'draft-1',
    status: 'DRAFT',
    attachments: [],
    formData: {},
    ...overrides,
  } as unknown as RegistrantProduct;
}

function makeAttachment(id: string, fileName: string): ProductAttachmentRecord {
  return { id, fileName, type: 'IMAGE' } as ProductAttachmentRecord;
}

function makeCommands(overrides: Partial<ProductDraftCommands> = {}): ProductDraftCommands {
  return {
    create: async () => ({ data: makeProduct() }),
    update: async (id) => ({ data: makeProduct({ id }) }),
    upload: async (_id, selected) => ({
      data: makeAttachment(`file-${selected.name}`, selected.name),
    }),
    detail: async () => ({ data: makeProduct() }),
    ...overrides,
  };
}

describe('registration unit validation & mapping (#24)', () => {
  it('validates required fields, trims input, and resolves localityCode from ward list', () => {
    const missing = validateRegistrationUnitInput(EMPTY_REGISTRATION_UNIT_FORM);
    assert.ok(missing.entityName);
    assert.ok(missing.representativeName);
    assert.ok(missing.representativeTitle);
    assert.ok(missing.contactAddress);
    assert.ok(missing.provinceName);
    assert.ok(missing.localityName);

    const code = resolveWardLocalityCode('Xã Tân Cương', [
      { code: '19001', name: 'Xã Tân Cương' },
    ]);
    assert.equal(code, 'XP19001');

    const payloadOut = toRegistrationUnitWriteInput({
      entityName: '  HTX Nông nghiệp Tân Cương ',
      representativeName: ' Nguyễn Văn A ',
      representativeTitle: ' Giám đốc ',
      contactAddress: ' Xóm Hồng Thái 2 ',
      provinceName: ' Tỉnh Thái Nguyên ',
      localityName: ' Xã Tân Cương ',
      localityCode: code,
      phone: '   ',
    });
    assert.deepEqual(payloadOut, {
      entityName: 'HTX Nông nghiệp Tân Cương',
      representativeName: 'Nguyễn Văn A',
      representativeTitle: 'Giám đốc',
      contactAddress: 'Xóm Hồng Thái 2',
      provinceName: 'Tỉnh Thái Nguyên',
      localityName: 'Xã Tân Cương',
      localityCode: 'XP19001',
      phone: null,
    });

    assert.deepEqual(registrationUnitToFormValues(sampleSavedUnit), {
      entityName: 'HTX Nông nghiệp Tân Cương',
      representativeName: 'Nguyễn Văn A',
      representativeTitle: 'Giám đốc',
      contactAddress: 'Xóm Hồng Thái 2, xã Tân Cương',
      provinceName: 'Tỉnh Thái Nguyên',
      localityName: 'Xã Tân Cương',
      localityCode: 'XP19001',
      phone: '0912345678',
    });
  });
});

describe('selecting saved registration unit in product editor (#25)', () => {
  it('fills unit fields, clears localityId, and preserves assessmentYear, email, and product fields', () => {
    const initial = {
      name: 'Chè móc câu Tân Cương',
      description: 'Đặc sản Thái Nguyên',
      categoryId: 'cat-1',
      localityId: 'loc-event-2025',
      localityName: 'Xã Cũ',
      localityCode: 'XP00001',
      entityName: '',
      representativeName: '',
      representativeTitle: '',
      contactAddress: '',
      provinceName: '',
      phone: '0900000000',
      email: 'account@example.com',
      assessmentYear: '2026',
      registrationType: 'FIRST',
      sampleQuantity: '2',
      declarationAccepted: true,
    };

    const next = applyRegistrationUnitToEditorValues(initial, sampleSavedUnit);
    assert.equal(next.entityName, sampleSavedUnit.entityName);
    assert.equal(next.representativeName, sampleSavedUnit.representativeName);
    assert.equal(next.representativeTitle, sampleSavedUnit.representativeTitle);
    assert.equal(next.contactAddress, sampleSavedUnit.contactAddress);
    assert.equal(next.provinceName, sampleSavedUnit.provinceName);
    assert.equal(next.localityName, sampleSavedUnit.localityName);
    assert.equal(next.localityCode, 'XP19001');
    assert.equal(next.phone, '0912345678');
    assert.equal(next.localityId, '');
    assert.equal(next.assessmentYear, '2026');
    assert.equal(next.email, 'account@example.com');
    assert.equal(next.name, 'Chè móc câu Tân Cương');
  });

  it('requires confirmation only when unit data was already entered and would change', () => {
    const blankWithAccountDefaultPhone = {
      entityName: '',
      representativeName: '',
      representativeTitle: '',
      contactAddress: '',
      provinceName: '',
      localityName: '',
      localityCode: '',
      localityId: '',
      phone: '0900000000',
    };
    assert.equal(
      hasEnteredUnitDataToConfirm(
        blankWithAccountDefaultPhone,
        sampleSavedUnit,
        '0900000000',
      ),
      false,
    );

    const alreadyEntered = {
      ...blankWithAccountDefaultPhone,
      entityName: 'Cơ sở đã nhập tay',
    };
    assert.equal(
      hasEnteredUnitDataToConfirm(alreadyEntered, sampleSavedUnit, '0900000000'),
      true,
    );

    const alreadyMatchingUnit = applyRegistrationUnitToEditorValues(
      blankWithAccountDefaultPhone,
      sampleSavedUnit,
    );
    assert.equal(
      hasEnteredUnitDataToConfirm(
        alreadyMatchingUnit,
        sampleSavedUnit,
        '0900000000',
      ),
      false,
    );
  });
});

describe('quick-saving new registration unit from product draft (#26)', () => {
  it('saves product draft + attachments first, then creates unit and blocks duplicate unit creation on subsequent saves', async () => {
    const samplePng = new File(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
      'minh-chung.png',
      { type: 'image/png', lastModified: 1 },
    );
    const draftPayload: ProductWriteInput = {
      name: 'Trà xanh Tân Cương',
      categoryId: 'cat-1',
      formData: {
        entityName: sampleSavedUnit.entityName,
        representativeName: sampleSavedUnit.representativeName,
        representativeTitle: sampleSavedUnit.representativeTitle,
        contactAddress: sampleSavedUnit.contactAddress,
        provinceName: sampleSavedUnit.provinceName,
        localityName: sampleSavedUnit.localityName,
        localityCode: sampleSavedUnit.localityCode ?? undefined,
        phone: sampleSavedUnit.phone ?? undefined,
        email: 'owner@example.com',
        assessmentYear: 2026,
        declarationAccepted: true,
      },
    };

    const draftResult = await saveProductDraft({
      payload: draftPayload,
      files: [samplePng],
      commands: makeCommands(),
    });
    assert.equal(draftResult.kind, 'saved');
    assert.equal(draftResult.product.attachments.length, 1);

    let unitCreateCalls = 0;
    const firstUnitSave = await quickSaveRegistrationUnitAfterDraft({
      enabled: true,
      values: sampleSavedUnit,
      createUnit: async (unitPayload) => {
        unitCreateCalls++;
        return {
          data: {
            ...sampleSavedUnit,
            ...unitPayload,
            id: 'unit-created-1',
          },
        };
      },
    });

    assert.equal(firstUnitSave.kind, QUICK_SAVE_UNIT_OUTCOME.SAVED);
    assert.equal(unitCreateCalls, 1);
    assert.equal(firstUnitSave.nextSelectedUnitId, 'unit-created-1');
    assert.equal(firstUnitSave.nextSaveUnitToSettings, false);

    // Subsequent save of the same product uses nextSelectedUnitId / nextSaveUnitToSettings
    const secondUnitSave = await quickSaveRegistrationUnitAfterDraft({
      enabled:
        firstUnitSave.nextSaveUnitToSettings &&
        !firstUnitSave.nextSelectedUnitId,
      values: sampleSavedUnit,
      createUnit: async () => {
        unitCreateCalls++;
        return { data: sampleSavedUnit };
      },
    });
    assert.equal(secondUnitSave.kind, QUICK_SAVE_UNIT_OUTCOME.SKIPPED);
    assert.equal(unitCreateCalls, 1);
  });

  it('keeps saved product draft and reports missing unit fields without calling unit API when unit fields are incomplete', async () => {
    let unitCreateCalls = 0;
    const result = await quickSaveRegistrationUnitAfterDraft({
      enabled: true,
      values: {
        entityName: 'HTX Mới chỉ nhập tên',
        representativeName: '',
        representativeTitle: '',
        contactAddress: '',
        provinceName: 'Tỉnh Thái Nguyên',
        localityName: '',
        localityCode: '',
        phone: '',
      },
      createUnit: async () => {
        unitCreateCalls++;
        return { data: sampleSavedUnit };
      },
    });

    assert.equal(result.kind, QUICK_SAVE_UNIT_OUTCOME.INCOMPLETE);
    assert.equal(unitCreateCalls, 0);
    assert.match(
      result.message,
      /Đã lưu hồ sơ sản phẩm nháp, nhưng chưa lưu đơn vị/i,
    );
  });

  it('distinguishes 4xx validation error from unknown network outcome and prevents blind retry duplicates', async () => {
    const failed400 = await quickSaveRegistrationUnitAfterDraft({
      enabled: true,
      values: sampleSavedUnit,
      createUnit: async () => {
        throw new ApiError('Dữ liệu đơn vị không hợp lệ', 400);
      },
    });
    assert.equal(failed400.kind, QUICK_SAVE_UNIT_OUTCOME.FAILED);
    assert.equal(failed400.nextSaveUnitToSettings, true);
    assert.match(
      failed400.message,
      /không thể lưu đơn vị vào Cấu hình chung/i,
    );

    const unknownNet = await quickSaveRegistrationUnitAfterDraft({
      enabled: true,
      values: sampleSavedUnit,
      createUnit: async () => {
        throw new Error('Network disconnected');
      },
    });
    assert.equal(unknownNet.kind, QUICK_SAVE_UNIT_OUTCOME.UNKNOWN);
    assert.equal(unknownNet.nextSaveUnitToSettings, false);
    assert.match(
      unknownNet.message,
      /kiểm tra danh sách đơn vị trong Cấu hình chung trước khi thử lưu lại/i,
    );
  });
});

describe('edit registration unit dialog hydration & combobox preservation (#34)', () => {
  it('reproduces why resetting a shared form with static empty defaultValues gets wiped on re-render, and keeps saved unit values when keyed with unit defaults', () => {
    const savedValues = registrationUnitToFormValues(sampleSavedUnit);

    // Pre-fix bug: form.reset(savedValues) followed by form.update({ defaultValues: EMPTY })
    // on the React re-render triggered by setModalOpen(true) wipes values back to EMPTY.
    const sharedForm = new FormApi({ defaultValues: EMPTY_REGISTRATION_UNIT_FORM });
    const unmountShared = sharedForm.mount();
    try {
      sharedForm.reset(savedValues);
      assert.equal(sharedForm.state.values.entityName, sampleSavedUnit.entityName);
      sharedForm.update({ defaultValues: EMPTY_REGISTRATION_UNIT_FORM });
      assert.equal(sharedForm.state.values.entityName, '');
      assert.equal(sharedForm.state.values.provinceName, '');
      assert.equal(sharedForm.state.values.localityName, '');
    } finally {
      unmountShared();
    }

    // Fixed pattern: each dialog open initializes its own form with initialValues.
    const editUnit1Form = new FormApi({ defaultValues: savedValues });
    const unmountEdit1 = editUnit1Form.mount();
    try {
      editUnit1Form.update({ defaultValues: savedValues });
      assert.deepEqual(editUnit1Form.state.values, savedValues);
    } finally {
      unmountEdit1();
    }

    const secondUnitWithoutPhone: RegistrationUnitRecord = {
      id: 'unit-2',
      entityName: 'Cơ sở mật ong',
      representativeName: 'Trần Thị B',
      representativeTitle: 'Chủ hộ',
      contactAddress: 'Số 2, Hà Nội',
      provinceName: 'Hà Nội',
      localityName: 'Ba Đình',
      localityCode: null,
      phone: null,
      createdAt: '2026-11-10T00:00:00.000Z',
      updatedAt: '2026-11-10T00:00:00.000Z',
    };
    const editUnit2Values = registrationUnitToFormValues(secondUnitWithoutPhone);
    const editUnit2Form = new FormApi({ defaultValues: editUnit2Values });
    const unmountEdit2 = editUnit2Form.mount();
    try {
      assert.equal(editUnit2Form.state.values.entityName, 'Cơ sở mật ong');
      assert.equal(editUnit2Form.state.values.phone, '');
      assert.equal(editUnit2Form.state.values.localityCode, '');
    } finally {
      unmountEdit2();
    }

    const createForm = new FormApi({ defaultValues: EMPTY_REGISTRATION_UNIT_FORM });
    const unmountCreate = createForm.mount();
    try {
      assert.deepEqual(createForm.state.values, EMPTY_REGISTRATION_UNIT_FORM);
    } finally {
      unmountCreate();
    }
  });

  it('preserves saved ward and localityCode before and after ward options load', () => {
    const loadedWards = [
      { code: '19001', name: 'Tân Cương' },
      { code: '19002', name: 'Phan Đình Phùng' },
    ];

    // Before ward options arrive asynchronously (empty array), fallback preserves saved code.
    assert.equal(
      resolveWardLocalityCode('Xã Tân Cương', [], 'XP19001'),
      'XP19001',
    );
    // Even if saved localityName has legacy prefix while loaded options strip prefixes, code stays intact.
    assert.equal(
      resolveWardLocalityCode('Xã Tân Cương', loadedWards, 'XP19001'),
      'XP19001',
    );
    // Re-selecting a ward from loaded options computes its XP<code> cleanly.
    assert.equal(
      resolveWardLocalityCode('Tân Cương', loadedWards, ''),
      'XP19001',
    );
  });
});
