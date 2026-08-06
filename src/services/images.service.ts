import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import type { UploadedPrivateFile } from '../types/files';
import { assertAllowedImage, inspectImage } from '../utils/image-files';
import { INLINE_IMAGES_DIR } from '../utils/private-storage';

@Injectable()
export class ImagesService {
  async storeInline(
    file: UploadedPrivateFile | undefined,
    baseUrl: string,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new UnsupportedMediaTypeException('An image file is required');
    }
    try {
      if (!file.mimetype.startsWith('image/')) {
        throw new UnsupportedMediaTypeException('File must be an image');
      }
      assertAllowedImage(file.originalname);
      await inspectImage(file.path);
      return { url: `${baseUrl}/${INLINE_IMAGES_DIR}/${file.filename}` };
    } catch (error) {
      await this.safeUnlink(file.path);
      throw error;
    }
  }

  private async safeUnlink(path: string) {
    try {
      await unlink(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
