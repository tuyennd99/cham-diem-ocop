import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from '../src/lib/api-error';
import {
  canStartProductDraftSave,
  saveProductDraft,
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

  it('rejects selections that would exceed the 20-file product limit or 10 MiB size limit before writing (FILE-02)', async () => {
    let writes = 0;
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'over-10mib.pdf', {
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
      /10\s*MiB/i,
    );
    assert.equal(writes, 0);

    await assert.rejects(
      saveProductDraft({
        payload,
        files: Array.from({ length: 21 }, (_, index) => file(`new-${index}.png`)),
        commands: commands({
          create: async () => {
            writes++;
            return { data: product() };
          },
        }),
      }),
      /20/,
    );
    assert.equal(writes, 0);

    const existing = product({
      attachments: Array.from({ length: 19 }, (_, index) => attachment(`${index}`, `${index}.png`)),
    });
    await assert.rejects(
      saveProductDraft({
        existingProduct: existing,
        payload,
        files: [file('twenty.png'), file('twenty-one.png')],
        commands: commands({
          update: async () => {
            writes++;
            return { data: existing };
          },
        }),
      }),
      /20/,
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
});
