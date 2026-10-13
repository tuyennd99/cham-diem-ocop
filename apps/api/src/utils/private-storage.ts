import { mkdirSync } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import { pipeline, Readable } from 'node:stream';
import { StreamableFile } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const MAX_DRAFT_BYTES = 200 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const INLINE_IMAGES_DIR = 'inline-images';

export function storageRoot(value = process.env.STORAGE_PATH) {
  return resolve(value ?? join(process.cwd(), 'storage'));
}

// Tên file ảnh chèn = <tên gốc đã làm sạch>-<uuidv7>. Sanitize để chống path
// traversal + bỏ unicode/ký tự lạ; uuid vẫn đảm bảo không trùng.
export function inlineImageFilename(originalname = '') {
  const ext = extname(originalname).toLowerCase();
  const base =
    basename(originalname, extname(originalname))
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '') // bỏ dấu tổ hợp: Ả→A, ế→e
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'image';
  return `${base}-${uuidv7()}${ext}`;
}

interface IncomingFile {
  stream: Readable;
  originalname?: string;
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
    const filename = uuidv7();
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
      .then(({ unlink }) => unlink(file.path))
      .then(() => callback(null))
      .catch((error: NodeJS.ErrnoException) =>
        callback(error.code === 'ENOENT' ? null : error),
      );
  }
}

export function privateUploadOptions(): MulterOptions {
  return {
    // busboy mặc định decode filename bằng latin1 → tên UTF-8 (tiếng Việt) hỏng.
    defParamCharset: 'utf8',
    limits: { fileSize: MAX_DRAFT_BYTES, files: 1 },
    storage: new PrivateStorage(),
  };
}

export function productUploadOptions(): MulterOptions {
  return {
    defParamCharset: 'utf8',
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    storage: new PrivateStorage(),
  };
}

// Ảnh chèn trong editor: thư mục con công khai riêng, tên = uuidv7 + đuôi gốc.
class InlineImageStorage {
  _handleFile(
    _request: unknown,
    file: IncomingFile,
    callback: StorageCallback,
  ) {
    const dir = join(storageRoot(), INLINE_IMAGES_DIR);
    mkdirSync(dir, { recursive: true });
    const filename = inlineImageFilename(file.originalname);
    const path = join(dir, filename);
    let size = 0;
    file.stream.on('data', (chunk: Buffer) => {
      size += chunk.length;
    });
    pipeline(file.stream, createWriteStream(path), (error) => {
      if (error) return callback(error);
      callback(null, { destination: dir, filename, path, size });
    });
  }

  _removeFile(
    _request: unknown,
    file: { path?: string },
    callback: (error: Error | null) => void,
  ) {
    if (!file.path) return callback(null);
    void import('node:fs/promises')
      .then(({ unlink }) => unlink(file.path))
      .then(() => callback(null))
      .catch((error: NodeJS.ErrnoException) =>
        callback(error.code === 'ENOENT' ? null : error),
      );
  }
}

export function imageUploadOptions(): MulterOptions {
  return {
    defParamCharset: 'utf8',
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    storage: new InlineImageStorage(),
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
