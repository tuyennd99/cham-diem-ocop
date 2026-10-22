import { UnsupportedMediaTypeException } from '@nestjs/common';
import { open } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import type { UploadedPrivateFile } from '../types/files';

const extensions: Record<string, { mime: string; kind: 'IMAGE' | 'PDF' }> = {
  png: { mime: 'image/png', kind: 'IMAGE' },
  jpg: { mime: 'image/jpeg', kind: 'IMAGE' },
  jpeg: { mime: 'image/jpeg', kind: 'IMAGE' },
  gif: { mime: 'image/gif', kind: 'IMAGE' },
  webp: { mime: 'image/webp', kind: 'IMAGE' },
  pdf: { mime: 'application/pdf', kind: 'PDF' },
};

export async function inspectProductUpload(file: UploadedPrivateFile) {
  const name = basename(file.originalname);
  if (!name || name !== file.originalname || /[\\/\0\r\n]/.test(name)) {
    throw new UnsupportedMediaTypeException('Invalid file name');
  }
  const rule = extensions[extname(name).slice(1).toLowerCase()];
  if (!rule || file.mimetype.toLowerCase() !== rule.mime || file.size < 1) {
    throw new UnsupportedMediaTypeException('Unsupported file type');
  }

  const handle = await open(file.path);
  try {
    const head = Buffer.alloc(12);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    const isPdf = bytesRead >= 5 && head.toString('ascii', 0, 5) === '%PDF-';
    const isPng = bytesRead >= 8 && head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = bytesRead >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    const isGif = bytesRead >= 4 && head.toString('ascii', 0, 4) === 'GIF8';
    const isWebp = bytesRead >= 12 && head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP';
    const valid = rule.kind === 'PDF'
      ? isPdf
      : rule.mime === 'image/png'
        ? isPng
        : rule.mime === 'image/jpeg'
          ? isJpeg
          : rule.mime === 'image/gif'
            ? isGif
            : isWebp;
    if (!valid) throw new UnsupportedMediaTypeException('File content does not match its type');
    return { mimeType: rule.mime, type: rule.kind === 'IMAGE' ? 'IMAGE' as const : 'EVIDENCE' as const };
  } finally {
    await handle.close();
  }
}
