import { UnsupportedMediaTypeException } from '@nestjs/common';
import { AttachmentType } from '@prisma/client';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectProductUpload } from './product-files';

describe('inspectProductUpload', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ocop-upload-spec-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeTempFile(name: string, bytes: Buffer) {
    const path = join(tempDir, name);
    writeFileSync(path, bytes);
    return path;
  }

  it('accepts a standard RIFF WEBP file', async () => {
    const webpBytes = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x14, 0x00, 0x00, 0x00, // size
      0x57, 0x45, 0x42, 0x50, // WEBP
      0x56, 0x50, 0x38, 0x20, // VP8
    ]);
    const path = writeTempFile('sample.webp', webpBytes);
    const result = await inspectProductUpload({
      originalname: 'sample.webp',
      mimetype: 'image/webp',
      size: webpBytes.length,
      filename: '019a0000-0000-7000-8000-000000000001',
      path,
    });
    expect(result).toEqual({
      mimeType: 'image/webp',
      type: AttachmentType.IMAGE,
    });
  });

  it('accepts a .webp file whose binary content is actually JPEG or PNG (common when saved from browsers/CDNs)', async () => {
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const path = writeTempFile('converted.webp', jpegBytes);
    const result = await inspectProductUpload({
      originalname: 'converted.webp',
      mimetype: 'image/webp',
      size: jpegBytes.length,
      filename: '019a0000-0000-7000-8000-000000000002',
      path,
    });
    expect(result).toEqual({
      mimeType: 'image/jpeg',
      type: AttachmentType.IMAGE,
    });
  });

  it('rejects a .webp file whose content is non-image (e.g. text/html)', async () => {
    const fakeBytes = Buffer.from('<!DOCTYPE html><html></html>', 'utf8');
    const path = writeTempFile('fake.webp', fakeBytes);
    await expect(
      inspectProductUpload({
        originalname: 'fake.webp',
        mimetype: 'image/webp',
        size: fakeBytes.length,
        filename: '019a0000-0000-7000-8000-000000000003',
        path,
      }),
    ).rejects.toThrow(UnsupportedMediaTypeException);
  });
});
