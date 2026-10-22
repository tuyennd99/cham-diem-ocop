import { myProductsApi } from "../../api";
import { messageOf } from "../../lib/api-error";
import { openAttachment } from "../../lib/attachments";

export function AttachmentLink({ productId, attachmentId, name }: { productId: string; attachmentId: string; name: string }) {
  async function open() { try { await openAttachment(await myProductsApi.attachment(productId, attachmentId), name, true); } catch (e) { window.alert(messageOf(e)); } }
  return <button type="button" className="text-link" onClick={() => void open()}>{name}</button>;
}
