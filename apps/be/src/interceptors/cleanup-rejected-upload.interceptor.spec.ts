import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, throwError } from 'rxjs';
import type { UploadedPrivateFile } from '../types/files';
import { CleanupRejectedUploadInterceptor } from './cleanup-rejected-upload.interceptor';

const storageKey = '018f47ba-7c00-7abc-8abc-1234567890ab';

describe('CleanupRejectedUploadInterceptor', () => {
  let storagePath: string;
  let originalStoragePath: string | undefined;

  beforeEach(async () => {
    originalStoragePath = process.env.STORAGE_PATH;
    storagePath = await mkdtemp(join(tmpdir(), 'ocop-upload-cleanup-'));
    process.env.STORAGE_PATH = storagePath;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (originalStoragePath === undefined) delete process.env.STORAGE_PATH;
    else process.env.STORAGE_PATH = originalStoragePath;
    await rm(storagePath, { recursive: true, force: true });
  });

  it('removes a stored upload and preserves the downstream error', async () => {
    const path = join(storagePath, storageKey);
    await writeFile(path, 'uploaded bytes');
    const failure = new Error('request validation failed');
    const interceptor = new CleanupRejectedUploadInterceptor();
    const result = interceptor.intercept(
      contextFor({ filename: storageKey, path }),
      { handle: () => throwError(() => failure) } as CallHandler,
    );

    await expect(lastValueFrom(result)).rejects.toBe(failure);
    await expect(readFile(path)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not remove a path that disagrees with its storage key and preserves the error', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const expectedPath = join(storagePath, storageKey);
    const suppliedPath = join(storagePath, 'other-upload');
    await writeFile(expectedPath, 'expected upload');
    await writeFile(suppliedPath, 'unrelated file');
    const failure = new Error('request validation failed');
    const interceptor = new CleanupRejectedUploadInterceptor();
    const result = interceptor.intercept(
      contextFor({ filename: storageKey, path: suppliedPath }),
      { handle: () => throwError(() => failure) } as CallHandler,
    );

    await expect(lastValueFrom(result)).rejects.toBe(failure);
    await expect(readFile(expectedPath)).resolves.toEqual(
      Buffer.from('expected upload'),
    );
    await expect(readFile(suppliedPath)).resolves.toEqual(
      Buffer.from('unrelated file'),
    );
  });
});

function contextFor(file: Pick<UploadedPrivateFile, 'filename' | 'path'>) {
  const request = { file };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}
