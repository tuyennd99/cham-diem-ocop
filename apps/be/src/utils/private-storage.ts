import { createReadStream, mkdirSync, createWriteStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import { pipeline, Readable } from 'node:stream';
import { ForbiddenException, StreamableFile } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const uuidStorageKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const storedFileMimeTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export function storageRoot(value = process.env.STORAGE_PATH) {
  return resolve(value ?? join(process.cwd(), 'storage'));
}

export function resolveStoredPath(storageKey: string, root = storageRoot()): string {
  const resolvedRoot = resolve(root);
  const path = resolve(join(resolvedRoot, storageKey));
  if (!uuidStorageKeyPattern.test(storageKey) || !path.startsWith(`${resolvedRoot}${sep}`)) {
    throw new ForbiddenException('Invalid storage key');
  }
  return path;
}

export async function removeUploadedPrivateFile(
  file: { filename: string; path: string },
  root = storageRoot(),
) {
  const storedPath = resolveStoredPath(file.filename, root);
  if (resolve(file.path) !== storedPath) {
    throw new ForbiddenException('Invalid uploaded file path');
  }
  try {
    await unlink(storedPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function openStoredFile(storageKey: string, originalName: string, root = storageRoot()) {
  const path = resolveStoredPath(storageKey, root);
  const extension = originalName.split('.').pop()?.toLowerCase();
  const info = await stat(path);
  return {
    stream: createReadStream(path),
    originalName,
    mimeType: storedFileMimeTypes[extension ?? ''] ?? 'application/octet-stream',
    sizeBytes: info.size,
  };
}

interface IncomingFile {
  stream: Readable;
}

interface StoredUpload {
  destination: string;
  filename: string;
  path: string;
  size: number;
}

type StorageCallback = (error: Error | null, file?: StoredUpload) => void;

class PrivateStorage {
  _handleFile(_request: unknown, file: IncomingFile, callback: StorageCallback) {
    const root = storageRoot();
    mkdirSync(root, { recursive: true });
    const filename = uuidv7();
    const path = join(root, filename);
    let size = 0;
    file.stream.on('data', (chunk: Buffer) => { size += chunk.length; });
    pipeline(file.stream, createWriteStream(path), (error) => {
      if (error) return callback(error);
      callback(null, { destination: root, filename, path, size });
    });
  }

  _removeFile(_request: unknown, file: { path?: string }, callback: (error: Error | null) => void) {
    if (!file.path) return callback(null);
    void import('node:fs/promises')
      .then(({ unlink }) => unlink(file.path!))
      .then(() => callback(null))
      .catch((error: NodeJS.ErrnoException) => callback(error.code === 'ENOENT' ? null : error));
  }
}

export function productUploadOptions(): MulterOptions {
  return {
    defParamCharset: 'utf8',
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    storage: new PrivateStorage(),
  };
}

export function asDownload(file: {
  stream: Readable;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}, disposition: 'attachment' | 'inline' = 'attachment') {
  return new StreamableFile(file.stream, {
    type: file.mimeType,
    length: file.sizeBytes,
    disposition: `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
  });
}
