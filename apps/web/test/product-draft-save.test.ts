import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from '../src/lib/api-error';
import {
  canStartProductDraftSave,
  saveProductDraft,
  validateProductDirectSubmitInput,
  type ProductDraftCommands,
} from '../src/lib/save-product-draft';
import type { ProductAttachmentRecord } from '../src/types/product';
import type { ProductWriteInput, RegistrantProduct } from '../src/types/registrant';

function file(name: string, type = 'image/png') {
  return new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], name, {
    type,
    lastModified: 1,
  });
}

function product(overrides: Partial<RegistrantProduct> = {}): RegistrantProduct {
  return {
    id: 'draft-1',
    status: 'DRAFT',
    attachments: [],
    formData: {},
    ...overrides,
  } as unknown as RegistrantProduct;
}

function attachment(id: string, fileName: string): ProductAttachmentRecord {
  return { id, fileName, type: 'IMAGE' } as ProductAttachmentRecord;
}

const payload: ProductWriteInput = { name: 'Test', categoryId: 'category-1', formData: {} };

function commands(overrides: Partial<ProductDraftCommands> = {}): ProductDraftCommands {
  return {
    create: async () => ({ data: product() }),
    update: async (id) => ({ data: product({ id }) }),
    upload: async (_id, selected) => ({ data: attachment(`file-${selected.name}`, selected.name) }),
    detail: async () => ({ data: product() }),
    ...overrides,
  };
}

describe('product draft save availability', () => {
  it('blocks another save while an upload or create outcome is unresolved', () => {
    assert.equal(
      canStartProductDraftSave({ reviewRequired: false, createOutcomeUnknown: true }),
      false,
    );
    assert.equal(
      canStartProductDraftSave({ reviewRequired: true, createOutcomeUnknown: false }),
      false,
    );
    assert.equal(
      canStartProductDraftSave({ reviewRequired: false, createOutcomeUnknown: false }),
      true,
    );
    assert.equal(
      canStartProductDraftSave({
        reviewRequired: false,
        createOutcomeUnknown: false,
        declarationAccepted: false,
      }),
      false,
    );
    assert.equal(
      canStartProductDraftSave({
        reviewRequired: false,
        createOutcomeUnknown: false,
        declarationAccepted: true,
      }),
      true,
    );
  });
});
describe('saveProductDraft', () => {
  it('validates every selected file before creating or updating', async () => {
    let writes = 0;
    await assert.rejects(
      saveProductDraft({
        payload,
        files: [file('valid.png'), file('invalid.png', 'application/pdf')],
        commands: commands({
          create: async () => {
            writes++;
            return { data: product() };
          },
        }),
      }),
      /đúng định dạng/i,
    );
    assert.equal(writes, 0);
  });

  it('rejects selections that would exceed the 5-file product limit or 2 MB size limit before writing (FILE-02)', async () => {
    let writes = 0;
    const oversized = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'over-2mb.pdf', {
      type: 'application/pdf',
      lastModified: 1,
    });
    await assert.rejects(
      saveProductDraft({
        payload,
        files: [oversized],
        commands: commands({
          create: async () => {
            writes++;
            return { data: product() };
          },
        }),
      }),
      /2\s*MB/i,
    );
    assert.equal(writes, 0);

    await assert.rejects(
      saveProductDraft({
        payload,
        files: Array.from({ length: 6 }, (_, index) => file(`new-${index}.png`)),
        commands: commands({
          create: async () => {
            writes++;
            return { data: product() };
          },
        }),
      }),
      /5/,
    );
    assert.equal(writes, 0);

    const existing = product({
      attachments: Array.from({ length: 4 }, (_, index) => attachment(`${index}`, `${index}.png`)),
    });
    await assert.rejects(
      saveProductDraft({
        existingProduct: existing,
        payload,
        files: [file('five.png'), file('six.png')],
        commands: commands({
          update: async () => {
            writes++;
            return { data: existing };
          },
        }),
      }),
      /5/,
    );
    assert.equal(writes, 0);
  });

  it('keeps the created ID and successful files after a later upload has an unknown outcome or 500 error (FILE-06)', async () => {
    const draft = product();
    const uploaded = attachment('file-1', 'one.png');
    const possiblyUploaded = attachment('file-2', 'two.png');
    let creates = 0;
    let uploads = 0;
    let details = 0;
    const result = await saveProductDraft({
      payload,
      files: [file('one.png'), file('two.png'), file('three.png')],
      commands: commands({
        create: async () => {
          creates++;
          return { data: draft };
        },
        upload: async (_id, selected) => {
          uploads++;
          if (uploads === 1) return { data: uploaded };
          throw new Error(`Connection lost for ${selected.name}`);
        },
        detail: async () => {
          details++;
          return { data: product({ attachments: [uploaded, possiblyUploaded] }) };
        },
      }),
    });
    assert.equal(creates, 1);
    assert.equal(uploads, 2);
    assert.equal(details, 1);
    assert.equal(result.kind, 'upload-failed');
    assert.equal(result.product.id, 'draft-1');
    assert.deepEqual(
      result.product.attachments.map(({ id }) => id),
      ['file-1', 'file-2'],
    );
    if (result.kind === 'upload-failed') {
      assert.equal(result.requiresReview, true);
      assert.deepEqual(result.remainingFiles, []);
      assert.equal(
        canStartProductDraftSave({
          reviewRequired: result.requiresReview,
          createOutcomeUnknown: false,
        }),
        false,
      );
    }

    const server500Result = await saveProductDraft({
      existingProduct: draft,
      payload,
      files: [file('one.png'), file('two.png')],
      commands: commands({
        update: async () => ({ data: draft }),
        upload: async (_id, selected) => {
          if (selected.name === 'one.png') return { data: uploaded };
          throw new ApiError('Internal Server Error', 500);
        },
        detail: async () => ({ data: product({ attachments: [uploaded] }) }),
      }),
    });
    assert.equal(server500Result.kind, 'upload-failed');
    if (server500Result.kind === 'upload-failed') {
      assert.equal(server500Result.product.id, 'draft-1');
      assert.equal(server500Result.requiresReview, true);
      assert.deepEqual(server500Result.remainingFiles, []);
      assert.equal(
        canStartProductDraftSave({
          reviewRequired: server500Result.requiresReview,
          createOutcomeUnknown: false,
        }),
        false,
      );
    }
  });

  it('stops on deterministic 415/4xx on second file and retries only remaining files using the same draft ID (FILE-03)', async () => {
    const createdDraft = product({ id: 'draft-file-03', attachments: [] });
    const validFirst = file('anh-chai-mat-ong.jpg', 'image/jpeg');
    const fakePdfSecond = file('gia-mao.pdf', 'application/pdf');
    const validPdfReplacement = file('giay-chung-nhan-attp.pdf', 'application/pdf');
    let creates = 0;
    const updateIds: string[] = [];
    const uploadedNames: string[] = [];

    const firstAttempt = await saveProductDraft({
      payload,
      files: [validFirst, fakePdfSecond],
      commands: commands({
        create: async () => {
          creates++;
          return { data: createdDraft };
        },
        upload: async (_id, selected) => {
          uploadedNames.push(selected.name);
          if (selected === fakePdfSecond) {
            throw new ApiError('File content does not match its type', 415);
          }
          return { data: attachment('att-1', selected.name) };
        },
      }),
    });
    assert.equal(creates, 1);
    assert.equal(firstAttempt.kind, 'upload-failed');
    assert.equal(firstAttempt.product.id, 'draft-file-03');
    assert.deepEqual(
      firstAttempt.product.attachments.map((item) => item.id),
      ['att-1'],
    );
    if (firstAttempt.kind !== 'upload-failed') return;
    assert.equal(firstAttempt.requiresReview, false);
    assert.deepEqual(firstAttempt.remainingFiles, [fakePdfSecond]);

    const secondAttempt = await saveProductDraft({
      existingProduct: firstAttempt.product,
      payload,
      files: [validPdfReplacement],
      commands: commands({
        create: async () => {
          creates++;
          return { data: createdDraft };
        },
        update: async (id) => {
          updateIds.push(id);
          return { data: firstAttempt.product };
        },
        upload: async (_id, selected) => {
          uploadedNames.push(selected.name);
          return { data: attachment('att-2', selected.name) };
        },
      }),
    });
    assert.equal(creates, 1);
    assert.deepEqual(updateIds, ['draft-file-03']);
    assert.equal(secondAttempt.kind, 'saved');
    assert.equal(secondAttempt.product.id, 'draft-file-03');
    assert.deepEqual(
      secondAttempt.product.attachments.map((item) => item.id),
      ['att-1', 'att-2'],
    );
  });

  it('does not retry a create whose response was lost', async () => {
    let creates = 0;
    let uploads = 0;
    await assert.rejects(
      saveProductDraft({
        payload,
        files: [file('one.png')],
        commands: commands({
          create: async () => {
            creates++;
            throw new Error('Connection lost');
          },
          upload: async () => {
            uploads++;
            return { data: attachment('one', 'one.png') };
          },
        }),
      }),
      /Connection lost/,
    );
    assert.equal(creates, 1);
    assert.equal(uploads, 0);
  });

  it('does not deduplicate distinct selected files with identical metadata', async () => {
    const first = file('same.png');
    const second = file('same.png');
    const uploaded: string[] = [];
    const result = await saveProductDraft({
      payload,
      files: [first, second],
      commands: commands({
        upload: async (_id, selected) => {
          uploaded.push(selected.name);
          return { data: attachment(`file-${uploaded.length}`, selected.name) };
        },
      }),
    });
    assert.equal(result.kind, 'saved');
    assert.deepEqual(uploaded, ['same.png', 'same.png']);
    assert.deepEqual(
      result.product.attachments.map(({ id }) => id),
      ['file-1', 'file-2'],
    );
  });

  it('preserves untouched formData fields when editing one field', async () => {
    const existing = product({ formData: { entityName: 'Old', legacyField: 'Keep me' } });
    let savedPayload: ProductWriteInput | undefined;
    await saveProductDraft({
      existingProduct: existing,
      payload: { ...payload, formData: { entityName: 'New' } },
      files: [],
      commands: commands({
        update: async (_id, data) => {
          savedPayload = data;
          return { data: existing };
        },
      }),
    });
    assert.deepEqual(savedPayload?.formData, { entityName: 'New', legacyField: 'Keep me' });
  });

  it('creates/updates, uploads files, and submits immediately when submitAfterSave is true (#27)', async () => {
    const steps: string[] = [];
    const seenSnapshots: string[] = [];
    const result = await saveProductDraft({
      payload,
      files: [file('one.png'), file('two.png')],
      submitAfterSave: true,
      onDraftSaved: (saved) => {
        seenSnapshots.push(`${saved.id}:${saved.status}:${saved.attachments.length}`);
      },
      commands: commands({
        create: async () => {
          steps.push('create');
          return { data: product({ id: 'draft-27', status: 'DRAFT' as never }) };
        },
        upload: async (id, selected) => {
          steps.push(`upload:${id}:${selected.name}`);
          return { data: attachment(`att-${selected.name}`, selected.name) };
        },
        submit: async (id) => {
          steps.push(`submit:${id}`);
          return {
            data: product({
              id,
              status: 'SUBMITTED' as never,
              attachments: [
                attachment('att-one.png', 'one.png'),
                attachment('att-two.png', 'two.png'),
              ],
            }),
          };
        },
      }),
    });

    assert.equal(result.kind, 'submitted');
    assert.equal(result.product.id, 'draft-27');
    assert.equal(result.product.status, 'SUBMITTED');
    assert.deepEqual(steps, [
      'create',
      'upload:draft-27:one.png',
      'upload:draft-27:two.png',
      'submit:draft-27',
    ]);
    assert.deepEqual(seenSnapshots, [
      'draft-27:DRAFT:0',
      'draft-27:DRAFT:1',
      'draft-27:DRAFT:2',
      'draft-27:SUBMITTED:2',
    ]);
  });

  it('does not call submit when an attachment upload fails during submitAfterSave (#27)', async () => {
    let submitted = 0;
    const result = await saveProductDraft({
      payload,
      files: [file('one.png')],
      submitAfterSave: true,
      commands: commands({
        create: async () => ({ data: product({ id: 'draft-upload-fail' }) }),
        upload: async () => {
          throw new ApiError('File rejected', 415);
        },
        submit: async () => {
          submitted++;
          return { data: product({ id: 'draft-upload-fail', status: 'SUBMITTED' as never }) };
        },
      }),
    });

    assert.equal(result.kind, 'upload-failed');
    assert.equal(submitted, 0);
    assert.equal(result.product.id, 'draft-upload-fail');
  });

  it('retains the saved draft product via onDraftSaved if submit fails so retry updates instead of duplicating (#27)', async () => {
    let capturedDraft: RegistrantProduct | undefined;
    let creates = 0;
    let updates = 0;
    await assert.rejects(
      saveProductDraft({
        payload,
        files: [file('one.png')],
        submitAfterSave: true,
        onDraftSaved: (saved) => {
          capturedDraft = saved;
        },
        commands: commands({
          create: async () => {
            creates++;
            return { data: product({ id: 'draft-keep-id' }) };
          },
          upload: async (_id, selected) => ({
            data: attachment('att-1', selected.name),
          }),
          submit: async () => {
            throw new ApiError('Submit failed', 400);
          },
        }),
      }),
      /Submit failed/,
    );
    assert.equal(creates, 1);
    assert.equal(capturedDraft?.id, 'draft-keep-id');
    assert.equal(capturedDraft?.attachments.length, 1);

    const retryResult = await saveProductDraft({
      existingProduct: capturedDraft,
      payload,
      files: [],
      submitAfterSave: true,
      commands: commands({
        create: async () => {
          creates++;
          return { data: product({ id: 'duplicate' }) };
        },
        update: async (id) => {
          updates++;
          return { data: product({ id, attachments: capturedDraft?.attachments ?? [] }) };
        },
        submit: async (id) => ({
          data: product({
            id,
            status: 'SUBMITTED' as never,
            attachments: capturedDraft?.attachments ?? [],
          }),
        }),
      }),
    });

    assert.equal(creates, 1);
    assert.equal(updates, 1);
    assert.equal(retryResult.kind, 'submitted');
    assert.equal(retryResult.product.id, 'draft-keep-id');
  });
});

describe('validateProductDirectSubmitInput (#27)', () => {
  const validInput = {
    name: 'Trà Shan Tuyết',
    categoryId: 'cat-1',
    provinceName: 'Tỉnh Hà Giang',
    localityName: 'Xã Phương Độ',
    entityName: 'HTX Trà Phương Độ',
    representativeName: 'Nguyễn Văn A',
    representativeTitle: 'Giám đốc',
    contactAddress: 'Thôn Hạ Thành, Xã Phương Độ',
    phone: '0901234567',
    email: 'htx@example.com',
    registrationType: 'FIRST',
    sampleQuantity: '2',
    assessmentYear: '2026',
    declarationAccepted: true,
  };

  it('passes when all required Mẫu số 01 fields are present', () => {
    assert.doesNotThrow(() => validateProductDirectSubmitInput(validInput));
    assert.doesNotThrow(() =>
      validateProductDirectSubmitInput({
        ...validInput,
        phone: '',
        email: 'only-email@example.com',
      }),
    );
    assert.doesNotThrow(() =>
      validateProductDirectSubmitInput({
        ...validInput,
        localityName: '',
        localityId: 'loc-1',
      }),
    );
  });

  it('rejects missing required fields with clear Vietnamese messages before calling API', () => {
    assert.throws(
      () => validateProductDirectSubmitInput({ ...validInput, provinceName: '' }),
      /Tỉnh\/Thành phố/,
    );
    assert.throws(
      () => validateProductDirectSubmitInput({ ...validInput, localityName: '', localityId: '' }),
      /Xã\/Phường/,
    );
    assert.throws(
      () => validateProductDirectSubmitInput({ ...validInput, entityName: '   ' }),
      /tên đơn vị sản xuất/i,
    );
    assert.throws(
      () => validateProductDirectSubmitInput({ ...validInput, representativeName: '' }),
      /người đại diện/i,
    );
    assert.throws(
      () => validateProductDirectSubmitInput({ ...validInput, representativeTitle: '' }),
      /chức vụ/i,
    );
    assert.throws(
      () => validateProductDirectSubmitInput({ ...validInput, contactAddress: '' }),
      /địa chỉ liên hệ/i,
    );
    assert.throws(
      () => validateProductDirectSubmitInput({ ...validInput, phone: '', email: '' }),
      /số điện thoại hoặc email/i,
    );
    assert.throws(
      () => validateProductDirectSubmitInput({ ...validInput, registrationType: '' }),
      /hình thức đăng ký/i,
    );
    assert.throws(
      () => validateProductDirectSubmitInput({ ...validInput, sampleQuantity: '0' }),
      /từ 1 đến 100000/,
    );
    assert.throws(
      () => validateProductDirectSubmitInput({ ...validInput, assessmentYear: '' }),
      /Năm đánh giá/,
    );
    assert.throws(
      () => validateProductDirectSubmitInput({ ...validInput, declarationAccepted: false }),
      /xác nhận cam kết/i,
    );
  });
});
