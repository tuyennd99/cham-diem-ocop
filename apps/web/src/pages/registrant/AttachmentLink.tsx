import { useEffect, useState } from 'react';
import { myProductsApi } from '../../api';
import { adminProductsApi } from '../../api/admin-products';
import { messageOf } from '../../lib/api-error';
import { openAttachment } from '../../lib/attachments';

export type ProductAttachmentMode = 'owner' | 'admin';

export function AttachmentLink({
  mode = 'owner',
  productId,
  attachmentId,
  name,
}: {
  productId: string;
  attachmentId: string;
  name: string;
  mode?: ProductAttachmentMode;
}) {
  async function open() {
    try {
      const blob =
        mode === 'admin'
          ? await adminProductsApi.attachment(productId, attachmentId)
          : await myProductsApi.attachment(productId, attachmentId);
      await openAttachment(blob, name, true);
    } catch (e) {
      window.alert(messageOf(e));
    }
  }
  return (
    <button type='button' className='text-link' onClick={() => void open()}>
      {name}
    </button>
  );
}

export function PrivateAttachmentThumbnail({
  mode,
  productId,
  attachmentId,
  name,
}: {
  mode: ProductAttachmentMode;
  productId: string;
  attachmentId: string;
  name: string;
}) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSrc('');
    setFailed(false);
    const request =
      mode === 'admin'
        ? adminProductsApi.attachment(productId, attachmentId)
        : myProductsApi.attachment(productId, attachmentId);
    void request
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setSrc(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, mode, productId]);

  if (failed) return <span role='status'>Không tải được ảnh riêng tư</span>;
  if (!src) return <span aria-busy='true'>Đang tải ảnh…</span>;
  return <img src={src} alt={name} loading='lazy' />;
}
