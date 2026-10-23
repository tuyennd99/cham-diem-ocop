export const PRODUCT_FILE_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf';

const fileTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export function validateProductFile(file: Pick<File, 'name' | 'type' | 'size'>): void {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!fileTypes[extension] || fileTypes[extension] !== file.type.toLowerCase() || file.size < 1) {
    throw new Error('Chỉ nhận PNG, JPEG, GIF, WebP hoặc PDF đúng định dạng.');
  }
  if (file.size > 10 * 1024 * 1024) throw new Error('Mỗi tệp tối đa 10 MiB.');
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
