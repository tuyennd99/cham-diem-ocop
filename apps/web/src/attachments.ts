import { apiBlob } from "./api";

export async function openAttachment(path: string, name: string, download = false) {
  const url = URL.createObjectURL(await apiBlob(path));
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.setAttribute("aria-label", `Mở ${name}`);
  if (download) link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
