import { UnsupportedMediaTypeException } from '@nestjs/common';
import { open } from 'node:fs/promises';
import { basename, extname } from 'node:path';

export type ImageType = 'png' | 'jpeg' | 'gif' | 'webp';

const imageExtensions: Record<string, ImageType> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  gif: 'gif',
  webp: 'webp',
};

export function assertAllowedImage(originalName: string): string {
  if (
    !originalName ||
    originalName !== basename(originalName) ||
    /[\0\r\n]/.test(originalName)
  ) {
    throw new UnsupportedMediaTypeException('Invalid file name');
  }
  const extension = extname(originalName).slice(1).toLowerCase();
  if (!(extension in imageExtensions)) {
    throw new UnsupportedMediaTypeException('Unsupported image extension');
  }
  return extension;
}

// Nhận diện ảnh qua magic-byte, không tin mimetype/đuôi tệp do client gửi.
export function sniffImageType(head: Buffer): ImageType | null {
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return 'png';
  }
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'jpeg';
  }
  if (
    head.length >= 4 &&
    head[0] === 0x47 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x38
  ) {
    return 'gif';
  }
  if (
    head.length >= 12 &&
    head.toString('ascii', 0, 4) === 'RIFF' &&
    head.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export async function inspectImage(path: string): Promise<ImageType> {
  const handle = await open(path);
  try {
    const head = Buffer.alloc(12);
    await handle.read(head, 0, 12, 0);
    const type = sniffImageType(head);
    if (!type) {
      throw new UnsupportedMediaTypeException('File is not a valid image');
    }
    return type;
  } finally {
    await handle.close();
  }
}
