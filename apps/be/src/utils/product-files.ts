import { PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { open } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import type { UploadedPrivateFile } from '../types/files';
import { MAX_FILE_BYTES, MAX_VIDEO_BYTES } from './private-storage';

const extensions: Record<string, { mime: string; kind: 'IMAGE' | 'PDF' | 'VIDEO' }> = {
  png: { mime: 'image/png', kind: 'IMAGE' },
  jpg: { mime: 'image/jpeg', kind: 'IMAGE' },
  jpeg: { mime: 'image/jpeg', kind: 'IMAGE' },
  gif: { mime: 'image/gif', kind: 'IMAGE' },
  webp: { mime: 'image/webp', kind: 'IMAGE' },
  pdf: { mime: 'application/pdf', kind: 'PDF' },
  mp4: { mime: 'video/mp4', kind: 'VIDEO' },
  webm: { mime: 'video/webm', kind: 'VIDEO' },
  mov: { mime: 'video/quicktime', kind: 'VIDEO' },
};

const mp4MovBoxTypes = new Set(['ftyp', 'moov', 'wide', 'mdat', 'free', 'skip']);

export function isVideoAttachmentName(fileName: string): boolean {
  const ext = extname(fileName).slice(1).toLowerCase();
  return extensions[ext]?.kind === 'VIDEO';
}

export async function inspectProductUpload(file: UploadedPrivateFile) {
  const name = basename(file.originalname);
  if (!name || name !== file.originalname || /[\\/\0\r\n]/.test(name)) {
    throw new UnsupportedMediaTypeException('Invalid file name');
  }
  const rule = extensions[extname(name).slice(1).toLowerCase()];
  if (!rule || file.mimetype.toLowerCase() !== rule.mime || file.size < 1) {
    throw new UnsupportedMediaTypeException('Unsupported file type');
  }
  if (rule.kind === 'VIDEO' && file.size > MAX_VIDEO_BYTES) {
    throw new PayloadTooLargeException('Attachment video exceeds 50 MB');
  }
  if (rule.kind !== 'VIDEO' && file.size > MAX_FILE_BYTES) {
    throw new PayloadTooLargeException('Attachment file exceeds 2 MB');
  }

  const handle = await open(file.path);
  try {
    const head = Buffer.alloc(12);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    const isPdf = bytesRead >= 5 && head.toString('ascii', 0, 5) === '%PDF-';
    const isPng =
      bytesRead >= 8 &&
      head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = bytesRead >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    const isGif = bytesRead >= 4 && head.toString('ascii', 0, 4) === 'GIF8';
    const isWebp =
      bytesRead >= 12 &&
      head.toString('ascii', 0, 4) === 'RIFF' &&
      head.toString('ascii', 8, 12) === 'WEBP';
    const isMp4OrMov = bytesRead >= 8 && mp4MovBoxTypes.has(head.toString('ascii', 4, 8));
    const isWebm =
      bytesRead >= 4 && head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));

    const valid =
      rule.kind === 'PDF'
        ? isPdf
        : rule.kind === 'VIDEO'
          ? rule.mime === 'video/webm'
            ? isWebm
            : isMp4OrMov
          : rule.mime === 'image/png'
            ? isPng
            : rule.mime === 'image/jpeg'
              ? isJpeg
              : rule.mime === 'image/gif'
                ? isGif
                : isWebp;
    if (!valid) throw new UnsupportedMediaTypeException('File content does not match its type');
    return {
      mimeType: rule.mime,
      type: rule.kind === 'IMAGE' ? ('IMAGE' as const) : ('EVIDENCE' as const),
    };
  } finally {
    await handle.close();
  }
}
