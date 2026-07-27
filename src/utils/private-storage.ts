import { mkdirSync } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline, Readable } from 'node:stream';
import { StreamableFile } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const MAX_DRAFT_BYTES = 200 * 1024 * 1024;

export function storageRoot(value = process.env.STORAGE_PATH) {
  return resolve(value ?? join(process.cwd(), 'storage'));
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
  _handleFile(
    _request: unknown,
    file: IncomingFile,
    callback: StorageCallback,
  ) {
    const root = storageRoot();
    mkdirSync(root, { recursive: true });
    const filename = randomUUID();
    const path = join(root, filename);
    let size = 0;
    file.stream.on('data', (chunk: Buffer) => {
      size += chunk.length;
    });
    pipeline(file.stream, createWriteStream(path), (error) => {
      if (error) return callback(error);
      callback(null, { destination: root, filename, path, size });
    });
  }

  _removeFile(
    _request: unknown,
    file: { path?: string },
    callback: (error: Error | null) => void,
  ) {
    if (!file.path) return callback(null);
    void import('node:fs/promises')
      .then(({ unlink }) => unlink(file.path!))
      .then(() => callback(null))
      .catch((error: NodeJS.ErrnoException) =>
        callback(error.code === 'ENOENT' ? null : error),
      );
  }
}

export function privateUploadOptions(): MulterOptions {
  return {
    limits: { fileSize: MAX_DRAFT_BYTES, files: 1 },
    storage: new PrivateStorage(),
  };
}

export function asDownload(file: {
  stream: Readable;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  return new StreamableFile(file.stream, {
    type: file.mimeType,
    length: file.sizeBytes,
    disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
  });
}
