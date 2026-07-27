import { Readable } from 'node:stream';
import { StreamableFile } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
export declare const MAX_DRAFT_BYTES: number;
export declare function storageRoot(value?: string | undefined): string;
export declare function privateUploadOptions(): MulterOptions;
export declare function asDownload(file: {
    stream: Readable;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
}): StreamableFile;
