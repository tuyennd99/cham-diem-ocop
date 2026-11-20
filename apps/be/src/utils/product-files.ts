import {
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { AttachmentType } from '@prisma/client';
import { open } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { UPLOAD_FILE_KIND, type UploadFileKind } from '../constants/products';
import type { UploadedPrivateFile } from '../types/files';
import { MAX_FILE_BYTES, MAX_VIDEO_BYTES } from './private-storage';

const extensions: Record<string, { mime: string; kind: UploadFileKind }> = {
  png: { mime: 'image/png', kind: UPLOAD_FILE_KIND.IMAGE },
  jpg: { mime: 'image/jpeg', kind: UPLOAD_FILE_KIND.IMAGE },
  jpeg: { mime: 'image/jpeg', kind: UPLOAD_FILE_KIND.IMAGE },
  gif: { mime: 'image/gif', kind: UPLOAD_FILE_KIND.IMAGE },
  webp: { mime: 'image/webp', kind: UPLOAD_FILE_KIND.IMAGE },
  pdf: { mime: 'application/pdf', kind: UPLOAD_FILE_KIND.PDF },
  mp4: { mime: 'video/mp4', kind: UPLOAD_FILE_KIND.VIDEO },
  webm: { mime: 'video/webm', kind: UPLOAD_FILE_KIND.VIDEO },
  mov: { mime: 'video/quicktime', kind: UPLOAD_FILE_KIND.VIDEO },
};

const imageMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

const mp4MovBoxTypes = new Set([
  'ftyp',
  'moov',
  'wide',
  'mdat',
  'free',
  'skip',
]);

export function isVideoAttachmentName(fileName: string): boolean {
  const ext = extname(fileName).slice(1).toLowerCase();
  return extensions[ext]?.kind === UPLOAD_FILE_KIND.VIDEO;
}

export function detectBufferMimeType(
  head: Buffer,
  bytesRead: number,
): string | null {
  if (bytesRead >= 5 && head.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf';
  }
  if (
    bytesRead >= 8 &&
    head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return 'image/png';
  }
  if (
    bytesRead >= 3 &&
    head[0] === 0xff &&
    head[1] === 0xd8 &&
    head[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (bytesRead >= 4 && head.toString('ascii', 0, 4) === 'GIF8') {
    return 'image/gif';
  }
  if (
    bytesRead >= 12 &&
    head.toString('ascii', 0, 4) === 'RIFF' &&
    head.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (
    bytesRead >= 4 &&
    head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  ) {
    return 'video/webm';
  }
  if (bytesRead >= 8 && mp4MovBoxTypes.has(head.toString('ascii', 4, 8))) {
    return 'video/mp4';
  }
  return null;
}

function matchesDetectedMime(
  rule: { mime: string; kind: UploadFileKind },
  detectedMime: string | null,
): boolean {
  if (!detectedMime) return false;
  if (rule.kind === UPLOAD_FILE_KIND.IMAGE) {
    return imageMimeTypes.has(detectedMime);
  }
  if (rule.kind === UPLOAD_FILE_KIND.PDF) {
    return detectedMime === 'application/pdf';
  }
  if (rule.mime === 'video/webm') {
    return detectedMime === 'video/webm';
  }
  return detectedMime === 'video/mp4';
}

export async function inspectProductUpload(file: UploadedPrivateFile) {
  const name = basename(file.originalname);
  if (!name || name !== file.originalname || /[\\/\0\r\n]/.test(name)) {
    throw new UnsupportedMediaTypeException('Invalid file name');
  }
  const rule = extensions[extname(name).slice(1).toLowerCase()];
  const incomingMime = file.mimetype.toLowerCase();
  if (
    !rule ||
    (incomingMime !== rule.mime &&
      incomingMime !== 'application/octet-stream') ||
    file.size < 1
  ) {
    throw new UnsupportedMediaTypeException('Unsupported file type');
  }
  if (rule.kind === UPLOAD_FILE_KIND.VIDEO && file.size > MAX_VIDEO_BYTES) {
    throw new PayloadTooLargeException('Attachment video exceeds 50 MB');
  }
  if (rule.kind !== UPLOAD_FILE_KIND.VIDEO && file.size > MAX_FILE_BYTES) {
    throw new PayloadTooLargeException('Attachment file exceeds 10 MB');
  }

  const handle = await open(file.path);
  try {
    const head = Buffer.alloc(12);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    const detectedMime = detectBufferMimeType(head, bytesRead);

    if (!matchesDetectedMime(rule, detectedMime)) {
      throw new UnsupportedMediaTypeException(
        'File content does not match its type',
      );
    }
    return {
      mimeType:
        detectedMime && imageMimeTypes.has(detectedMime)
          ? detectedMime
          : rule.mime,
      type:
        rule.kind === UPLOAD_FILE_KIND.IMAGE
          ? AttachmentType.IMAGE
          : AttachmentType.EVIDENCE,
    };
  } finally {
    await handle.close();
  }
}
