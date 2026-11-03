export const PRODUCT_DOCUMENT_IMAGE_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf';
export const PRODUCT_VIDEO_ACCEPT = '.mp4,.webm,.mov';
export const PRODUCT_FILE_ACCEPT = `${PRODUCT_DOCUMENT_IMAGE_ACCEPT},${PRODUCT_VIDEO_ACCEPT}`;

export const MAX_PRODUCT_FILES = 5;
export const MAX_PRODUCT_VIDEOS = 1;
export const MAX_PRODUCT_ATTACHMENTS = MAX_PRODUCT_FILES + MAX_PRODUCT_VIDEOS;

export const MAX_PRODUCT_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_PRODUCT_VIDEO_BYTES = 50 * 1024 * 1024;

const documentAndImageTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

const videoTypes: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

export function isVideoFileName(fileName: string): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return Boolean(videoTypes[extension]);
}

export function isVideoProductFile(file: Pick<File, 'name' | 'type'>): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return Boolean(videoTypes[extension]) || file.type.toLowerCase().startsWith('video/');
}

export function validateProductFile(file: Pick<File, 'name' | 'type' | 'size'>): void {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mime = file.type.toLowerCase();

  if (videoTypes[extension]) {
    if (videoTypes[extension] !== mime || file.size < 1) {
      throw new Error('Video chỉ nhận định dạng MP4, WebM hoặc MOV hợp lệ.');
    }
    if (file.size > MAX_PRODUCT_VIDEO_BYTES) {
      throw new Error('Mỗi video tối đa 50 MB.');
    }
    return;
  }

  if (
    !documentAndImageTypes[extension] ||
    documentAndImageTypes[extension] !== mime ||
    file.size < 1
  ) {
    throw new Error(
      'Chỉ nhận ảnh (PNG, JPEG, GIF, WebP), tài liệu PDF hoặc video (MP4, WebM, MOV) đúng định dạng.',
    );
  }
  if (file.size > MAX_PRODUCT_FILE_BYTES) {
    throw new Error('Mỗi tệp ảnh hoặc tài liệu tối đa 2 MB.');
  }
}

export async function openAttachment(blob: Blob, name: string, download = false) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.setAttribute('aria-label', `Mở ${name}`);
  if (download) link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
