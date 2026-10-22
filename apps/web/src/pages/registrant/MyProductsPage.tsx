import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { myProductsApi } from "../../api";
import { errorText, messageOf } from "../../lib/api-error";
import { Button } from "@/components/ui/button";
import { queryKeys } from "../../constants/query-key";
import { useMyProducts } from "../../queries/registrant";
import type { RegistrantProduct as Product } from "../../types/registrant";

export function MyProductsPage() {
  const queryClient = useQueryClient();
  const { data: products = [], error: loadError, isPending: loading, refetch } = useMyProducts();
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const error = actionError || errorText(loadError);
  const refresh = async () => {
    setActionError("");
    await refetch();
  };
  async function remove(id: string) {
    if (busy || !window.confirm("Xóa bản nháp này?")) return;
    setBusy(true); setActionError("");
    try {
      await myProductsApi.remove(id);
      queryClient.setQueryData<Product[]>(queryKeys.myProducts.list, (rows = []) => rows.filter((item) => item.id !== id));
    }
    catch (cause) { setActionError(messageOf(cause)); }
    finally { setBusy(false); }
  }
  async function submit(id: string) {
    if (busy || !window.confirm("Nộp hồ sơ này để bắt đầu đánh giá? Sau khi nộp, không thể sửa bản nháp.")) return;
    setBusy(true); setActionError("");
    try {
      const { data } = await myProductsApi.submit(id);
      queryClient.setQueryData<Product[]>(queryKeys.myProducts.list, (rows = []) => rows.map((item) => item.id === id ? { ...item, ...data } : item));
      queryClient.setQueryData<Product>(queryKeys.myProducts.detail(id), (current) => current ? { ...current, ...data } : data);
    }
    catch (cause) { setActionError(messageOf(cause)); }
    finally { setBusy(false); }
  }
  return <section><div className="section-heading"><div><p className="eyebrow">KHU VỰC CHỦ THỂ</p><h1>Hồ sơ của tôi</h1></div><Link className="button button-primary" to="/my/products/new">Tạo hồ sơ</Link></div>
    {error && <div className="form-note" role="alert"><p>{error}</p><Button type="button" variant="secondary" disabled={loading || busy} onClick={() => void refresh()}>Thử lại</Button></div>}{loading && <p>Đang tải hồ sơ…</p>}
    {!loading && !error && !products.length && <div className="empty-state"><h2>Chưa có hồ sơ</h2><p>Tạo bản nháp để bắt đầu đăng ký sản phẩm.</p><Link className="button button-primary" to="/my/products/new">Tạo hồ sơ</Link></div>}
    {!loading && !error && <div className="record-list">{products.map((product) => <article className="record-row" key={product.id}><div className="record-main"><div className="record-badges"><span className="badge badge-category">{product.category.groupName} · {product.category.name}</span><span className="badge">{product.status}</span></div><h2>{product.name}</h2><p className="record-origin">{product.submittedAt ? `Đã nộp ${new Date(product.submittedAt).toLocaleString("vi-VN")}` : `Cập nhật ${new Date(product.updatedAt).toLocaleString("vi-VN")}`}</p><p>{product.attachments.length} tệp đính kèm</p></div><div className="record-result">{product.finalScore !== null && <strong>{product.finalScore} điểm · {product.starRating} sao</strong>}<Link className="button button-secondary" to="/my/products/$id" params={{ id: product.id }}>Mở hồ sơ</Link>{product.status === "DRAFT" && <><Link className="text-link" to="/my/products/$id/edit" params={{ id: product.id }}>Sửa bản nháp</Link><Button variant="secondary" disabled={busy} onClick={() => void submit(product.id)}>Nộp hồ sơ</Button><Button variant="secondary" disabled={busy} onClick={() => void remove(product.id)}>Xóa</Button></>}</div></article>)}</div>}
  </section>;
}
