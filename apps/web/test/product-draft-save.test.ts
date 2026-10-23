import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from '../src/lib/api-error';
import { saveProductDraft, type ProductDraftCommands } from '../src/lib/save-product-draft';
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

  it('rejects selections that would exceed the 20-file product limit before writing', async () => {
    let writes = 0;
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

  it('keeps the created ID and successful files after a later upload has an unknown outcome', async () => {
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
    }
  });

  it('stops on deterministic 4xx and retries the remaining files using the same draft ID', async () => {
    const existing = product({
      id: 'existing-draft',
      attachments: [attachment('saved', 'saved.png')],
    });
    const first = file('first.png');
    const rejected = file('rejected.png');
    const later = file('later.png');
    const updateIds: string[] = [];
    let firstAttemptUploads = 0;
    const firstResult = await saveProductDraft({
      existingProduct: existing,
      payload,
      files: [first, rejected, later],
      commands: commands({
        update: async (id) => {
          updateIds.push(id);
          return { data: existing };
        },
        upload: async (_id, selected) => {
          firstAttemptUploads++;
          if (selected === rejected) throw new ApiError('Rejected file', 400);
          return { data: attachment('saved-first', selected.name) };
        },
      }),
    });
    assert.equal(firstResult.kind, 'upload-failed');
    assert.equal(firstResult.product.id, 'existing-draft');
    if (firstResult.kind !== 'upload-failed') return;
    assert.equal(firstResult.requiresReview, false);
    assert.deepEqual(firstResult.remainingFiles, [rejected, later]);
    assert.equal(firstAttemptUploads, 2);

    let creates = 0;
    const retry = await saveProductDraft({
      existingProduct: firstResult.product,
      payload,
      files: firstResult.remainingFiles,
      commands: commands({
        create: async () => {
          creates++;
          return { data: existing };
        },
        update: async (id) => {
          updateIds.push(id);
          return { data: firstResult.product };
        },
      }),
    });
    assert.equal(creates, 0);
    assert.deepEqual(updateIds, ['existing-draft', 'existing-draft']);
    assert.equal(retry.kind, 'saved');
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
