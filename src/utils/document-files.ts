import {
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { basename, extname } from 'node:path';
import type { DocumentType } from '../types/files';
import { MAX_DRAFT_BYTES } from './private-storage';

const documentMimes: Record<Exclude<DocumentType, 'unknown'>, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function assertDraftSize(sizeBytes: number) {
  if (sizeBytes > MAX_DRAFT_BYTES) {
    throw new PayloadTooLargeException('Draft attachments exceed 200MB');
  }
}

export function assertAllowedDocument(
  originalName: string,
): Exclude<DocumentType, 'unknown'> {
  if (
    !originalName ||
    originalName !== basename(originalName) ||
    /[\0\r\n]/.test(originalName)
  ) {
    throw new UnsupportedMediaTypeException('Invalid file name');
  }
  const extension = extname(originalName).slice(1).toLowerCase();
  // Chỉ kiểm tra phần mở rộng tên tệp, không đọc nội dung/magic-byte.
  if (!(extension in documentMimes)) {
    throw new UnsupportedMediaTypeException('Unsupported file extension');
  }
  return extension as Exclude<DocumentType, 'unknown'>;
}

export function documentMime(type: Exclude<DocumentType, 'unknown'>) {
  return documentMimes[type];
}

export async function inspectDocument(path: string) {
  const checksum = createHash('sha256');
  let sizeBytes = 0;
  for await (const value of createReadStream(path)) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    checksum.update(chunk);
    sizeBytes += chunk.length;
  }
  return { sizeBytes, checksum: checksum.digest('hex') };
}
