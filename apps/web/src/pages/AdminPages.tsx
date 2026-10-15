import { Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { api, messageOf, type ApiResult } from "../api";
import type { Criterion as SharedCriterion, Product as SharedProduct } from "@ocop/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApi } from "../use-api";
import type { Category as ProductCategoryView } from "../types";

interface Judge { id: string; email: string; fullName: string; phone: string | null; verified: boolean; isActive: boolean; createdAt: string }
type Criterion = Pick<SharedCriterion, "id" | "code" | "name">;
type Category = ProductCategoryView & { groupCode: string; criteriaSet?: { criteria: SharedCriterion[] } | null };
interface Assignment { judgeId: string; categoryId: string; criterionIds: string[]; judge: Pick<Judge, "id" | "email" | "fullName" | "isActive">; category: Pick<Category, "id" | "name" | "groupCode" | "groupName"> }
type AdminProduct = Pick<SharedProduct, "id" | "name" | "status" | "finalScore" | "starRating" | "createdAt" | "category"> & { status: string; finalScore: number | null; starRating: number | null; createdAt: string; category: Category; registrant: { id: string; fullName: string; email: string }; evaluations: { judgeId: string; status: string; total: number | null }[] };

interface AdminDashboard {
  productsByStatus: Record<"DRAFT" | "SUBMITTED" | "SCORING" | "COMPLETED", number>;
  judges: { judgeId: string; fullName: string; assigned: number; submitted: number; pending: number }[];
  needsAttention: { id: string; name: string; status: "SUBMITTED" | "SCORING"; submittedAt: string | null; category: { id: string; name: string; groupName: string }; assignedJudgeCount: number; submittedEvaluationCount: number; pendingEvaluationCount: number }[];
}

const dashboardStatusLabel = { DRAFT: "Bản nháp", SUBMITTED: "Đã nộp", SCORING: "Đang chấm", COMPLETED: "Hoàn tất" } as const;

export function AdminDashboardPage() {
  const { result, loading, error } = useApi<AdminDashboard>("/admin/dashboard");
  const data = result?.data ?? null;

  return <section className="admin-dashboard">
    <div className="section-heading"><div><p className="eyebrow">QUẢN TRỊ OCOP</p><h1>Tổng quan</h1><p className="section-intro">Tiến độ hồ sơ và phiếu chấm theo dữ liệu hệ thống.</p></div></div>
    <nav className="quick-links" aria-label="Lối tắt quản trị"><Link to="/admin/products">Tất cả hồ sơ</Link><Link to="/admin/judges">Quản lý giám khảo</Link><Link to="/admin/assignments">Phân công</Link></nav>
    {loading && <div className="dashboard-skeleton" aria-label="Đang tải tổng quan" aria-busy="true"><div className="skeleton-block" /><div className="skeleton-block" /><div className="skeleton-block" /><div className="skeleton-table" /></div>}
    {error && <div className="empty-state" role="alert"><h2>Chưa tải được tổng quan</h2><p>{error}</p><p>Hãy thử tải lại hoặc mở trực tiếp danh sách hồ sơ.</p><Link to="/admin/products">Mở danh sách hồ sơ</Link></div>}
    {data && <>
      <div className="dashboard-status-grid" aria-label="Hồ sơ theo trạng thái">
        {(Object.keys(dashboardStatusLabel) as (keyof typeof dashboardStatusLabel)[]).map((status) => <article className="dashboard-stat" key={status}><span>{dashboardStatusLabel[status]}</span><strong>{data.productsByStatus[status]}</strong></article>)}
      </div>
      <section className="dashboard-section"><div className="section-heading"><div><h2>Tiến độ giám khảo</h2><p>Phiếu đã nộp trên tổng số hồ sơ được giao.</p></div></div>
        {data.judges.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th scope="col">Giám khảo</th><th scope="col">Đã nộp</th><th scope="col">Chưa hoàn tất</th><th scope="col">Tiến độ</th></tr></thead><tbody>{data.judges.map((judge) => { const percent = judge.assigned ? Math.round(judge.submitted / judge.assigned * 100) : 0; return <tr key={judge.judgeId}><th scope="row">{judge.fullName}</th><td>{judge.submitted} / {judge.assigned}</td><td>{judge.pending}</td><td><div className="progress-track" role="progressbar" aria-label={`Tiến độ của ${judge.fullName}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div><span>{percent}%</span></td></tr>; })}</tbody></table></div> : <div className="empty-state"><h3>Chưa có giám khảo hoạt động</h3><p>Dữ liệu tiến độ sẽ xuất hiện sau khi có phân công.</p><Link to="/admin/judges">Quản lý giám khảo</Link></div>}
      </section>
      <section className="dashboard-section"><div className="section-heading"><div><h2>Hồ sơ cần xử lý tiếp</h2><p>Hồ sơ đang chờ hoặc đang trong quá trình chấm.</p></div></div>
        {data.needsAttention.length ? <div className="record-list">{data.needsAttention.map((product) => <article className="record-row" key={product.id}><div className="record-main"><span className="badge badge-category">{product.category.groupName} · {product.category.name}</span><h3>{product.name}</h3><p>{product.status === "SUBMITTED" ? "Đã nộp" : "Đang chấm"} · {product.pendingEvaluationCount} phiếu chưa hoàn tất</p></div><div className="record-result"><span>{product.submittedEvaluationCount} / {product.assignedJudgeCount} phiếu</span><Link className="button button-secondary" to="/admin/products/$id" params={{ id: product.id }}>Mở hồ sơ</Link></div></article>)}</div> : <div className="empty-state"><h3>Không có hồ sơ chờ xử lý</h3><p>Danh sách này sẽ cập nhật khi có hồ sơ đã nộp hoặc đang chấm.</p></div>}
      </section>
    </>}
  </section>;
}

export function AdminJudgesPage() {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api<Judge[]>("/admin/judges").then(({ data }) => setJudges(data)).catch((e) => setError(messageOf(e)));
  useEffect(() => { void load(); }, []);
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const formElement = event.currentTarget; setError(""); setNotice(""); setBusy(true); const form = new FormData(formElement); try { await api("/admin/judges", { method: "POST", body: JSON.stringify({ email: form.get("email"), fullName: form.get("fullName"), phone: form.get("phone") || undefined, password: form.get("password") }) }); formElement.reset(); setNotice("Đã tạo tài khoản giám khảo."); await load(); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); } }
  async function update(judge: Judge, form: HTMLFormElement) { const data = new FormData(form); try { await api(`/admin/judges/${judge.id}`, { method: "PUT", body: JSON.stringify({ fullName: data.get("fullName"), phone: data.get("phone") || null }) }); setNotice("Đã cập nhật giám khảo."); await load(); } catch (e) { setError(messageOf(e)); } }
  async function resetPassword(judge: Judge, form: HTMLFormElement) { const password = new FormData(form).get("password"); try { await api(`/admin/judges/${judge.id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }); form.reset(); setNotice("Đã đặt mật khẩu mới."); } catch (e) { setError(messageOf(e)); } }
  async function deactivate(judge: Judge) { if (!window.confirm(`Ngừng hoạt động tài khoản ${judge.email}?`)) return; try { await api(`/admin/judges/${judge.id}`, { method: "DELETE" }); await load(); } catch (e) { setError(messageOf(e)); } }
  return <section><p className="eyebrow">QUẢN TRỊ</p><h1>Quản lý giám khảo</h1>{error && <p role="alert" className="form-note">{error}</p>}{notice && <p role="status">{notice}</p>}<section className="route-panel"><h2>Tạo tài khoản giám khảo</h2><form className="account-form" onSubmit={create}><label>Họ tên<Input name="fullName" maxLength={255} required /></label><label>Email<Input name="email" type="email" maxLength={320} required /></label><label>Số điện thoại<Input name="phone" type="tel" maxLength={30} /></label><label>Mật khẩu tạm thời<Input name="password" type="password" minLength={12} maxLength={72} required /></label><Button disabled={busy}>{busy ? "Đang tạo…" : "Tạo giám khảo"}</Button></form></section><h2>Danh sách giám khảo</h2><div className="record-list">{judges.map((judge) => <article className="route-panel" key={judge.id}><form className="account-form" onSubmit={(e) => { e.preventDefault(); void update(judge, e.currentTarget); }}><strong>{judge.email} · {judge.isActive ? "Đang hoạt động" : "Đã ngừng"}</strong><label>Họ tên<Input name="fullName" defaultValue={judge.fullName} maxLength={255} required /></label><label>Số điện thoại<Input name="phone" defaultValue={judge.phone ?? ""} maxLength={30} /></label><Button variant="secondary">Lưu thay đổi</Button></form><form className="account-form" onSubmit={(e) => { e.preventDefault(); void resetPassword(judge, e.currentTarget); }}><label>Đặt mật khẩu mới<Input name="password" type="password" minLength={12} maxLength={72} required /></label><Button variant="secondary">Đặt lại mật khẩu</Button></form>{judge.isActive && <Button variant="secondary" onClick={() => void deactivate(judge)}>Ngừng hoạt động</Button>}</article>)}</div></section>;
}

export function AdminAssignmentsPage() {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [savedAssignments, setSavedAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [judgeId, setJudgeId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [criterionIds, setCriterionIds] = useState<string[]>([]);
  useEffect(() => { let active = true; Promise.all([api<Judge[]>("/admin/judges"), api<Category[]>("/categories"), api<Assignment[]>("/admin/assignments")]).then(([j, c, a]) => { if (!active) return; setJudges(j.data.filter((item) => item.isActive)); setCategories(c.data); setAssignments(a.data); setSavedAssignments(a.data); }).catch((e) => { if (active) setError(messageOf(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const keyOf = (judge: string, category: string) => `${judge}:${category}`;
  const originalByKey = new Map(savedAssignments.map((item) => [keyOf(item.judgeId, item.categoryId), item]));
  const currentByKey = new Map(assignments.map((item) => [keyOf(item.judgeId, item.categoryId), item]));
  const added = assignments.filter((item) => !originalByKey.has(keyOf(item.judgeId, item.categoryId)));
  const removed = savedAssignments.filter((item) => !currentByKey.has(keyOf(item.judgeId, item.categoryId)));
  const scopeChanged = assignments.filter((item) => {
    const saved = originalByKey.get(keyOf(item.judgeId, item.categoryId));
    return saved && [...saved.criterionIds].sort().join("|") !== [...item.criterionIds].sort().join("|");
  });
  const dirty = Boolean(added.length || removed.length || scopeChanged.length);
  const touchedCategories = [...new Set([...added, ...removed, ...scopeChanged].map((item) => item.category.groupName + " · " + item.category.name))];

  function applyScope() {
    if (!judgeId || !categoryId || !selectedCategory) return;
    const judge = judges.find((item) => item.id === judgeId);
    if (!judge) return;
    const existing = assignments.find((item) => item.judgeId === judgeId && item.categoryId === categoryId);
    const next: Assignment = existing
      ? { ...existing, criterionIds }
      : { judgeId, categoryId, criterionIds, judge: { id: judge.id, email: judge.email, fullName: judge.fullName, isActive: judge.isActive }, category: { id: selectedCategory.id, name: selectedCategory.name, groupCode: selectedCategory.groupCode, groupName: selectedCategory.groupName } };
    setAssignments((current) => existing ? current.map((item) => item === existing ? next : item) : [...current, next]);
    setNotice("");
  }

  function toggleCell(judge: Judge, category: Category) {
    const existing = assignments.find((item) => item.judgeId === judge.id && item.categoryId === category.id);
    setAssignments((current) => existing
      ? current.filter((item) => item !== existing)
      : [...current, { judgeId: judge.id, categoryId: category.id, criterionIds: [], judge: { id: judge.id, email: judge.email, fullName: judge.fullName, isActive: judge.isActive }, category: { id: category.id, name: category.name, groupCode: category.groupCode, groupName: category.groupName } }]);
    setNotice("");
  }

  async function save() {
    if (!dirty) return;
    const diffText = `${added.length} thêm, ${removed.length} xóa, ${scopeChanged.length} đổi phạm vi`;
    const groupsText = touchedCategories.length ? touchedCategories.join(", ") : "không có nhóm thay đổi";
    if (!window.confirm(`API sẽ thay thế TOÀN BỘ danh sách phân công hiện tại. Thay đổi: ${diffText}. Nhóm liên quan: ${groupsText}. Tiếp tục?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data } = await api<Assignment[]>("/admin/assignments", { method: "PUT", body: JSON.stringify({ assignments: assignments.map(({ judgeId: assignedJudgeId, categoryId: assignedCategoryId, criterionIds: assignedCriteria }) => ({ judgeId: assignedJudgeId, categoryId: assignedCategoryId, criterionIds: assignedCriteria })) }) });
      setAssignments(data); setSavedAssignments(data); setNotice("Đã thay thế toàn bộ phân công.");
    } catch (cause) { setError(`Chưa lưu được danh sách thay thế. Nhóm liên quan: ${groupsText}. ${messageOf(cause)}`); }
    finally { setBusy(false); }
  }

  const coverage = categories.map((category) => {
    const criteria = category.criteriaSet?.criteria ?? [];
    const assigned = assignments.filter((item) => item.categoryId === category.id);
    const missing = criteria.filter((criterion) => !assigned.some((item) => item.criterionIds.length === 0 || item.criterionIds.includes(criterion.id)));
    return { category, criteria, assigned, missing };
  });

  return <section className="assignment-page">
    <p className="eyebrow">QUẢN TRỊ</p><h1>Phân công giám khảo</h1>
    <p className="assignment-warning">Lưu sẽ thay thế toàn bộ phân công hiện tại, không chỉ dòng đang sửa. Xem trước thay đổi và xác nhận trước khi gửi.</p>
    {error && <p role="alert" className="form-note">{error}</p>}{notice && <p role="status" className="form-success">{notice}</p>}
    {loading ? <div className="dashboard-skeleton" aria-busy="true" aria-label="Đang tải phân công"><div className="skeleton-table" /></div> : error && !categories.length ? <div className="empty-state"><h2>Chưa tải được phân công</h2><p>Kiểm tra quyền truy cập hoặc kết nối rồi thử lại.</p></div> : <>
      <section className="route-panel assignment-editor"><h2>Thêm hoặc sửa phạm vi</h2><div className="assignment-form-grid">
        <label>Giám khảo<select value={judgeId} onChange={(event) => setJudgeId(event.target.value)}><option value="">Chọn giám khảo</option>{judges.map((judge) => <option key={judge.id} value={judge.id}>{judge.fullName}</option>)}</select></label>
        <label>Nhóm sản phẩm<select value={categoryId} onChange={(event) => { const nextId = event.target.value; const existing = assignments.find((item) => item.judgeId === judgeId && item.categoryId === nextId); setCategoryId(nextId); setCriterionIds(existing?.criterionIds ?? []); }}><option value="">Chọn nhóm</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.groupName} · {category.name}</option>)}</select></label>
        {selectedCategory && <label className="assignment-criteria">Phạm vi tiêu chí<select multiple value={criterionIds} onChange={(event) => setCriterionIds(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>{selectedCategory.criteriaSet?.criteria.map((criterion) => <option key={criterion.id} value={criterion.id}>{criterion.code} · {criterion.name}</option>)}</select><span>Để trống nghĩa là giao toàn bộ tiêu chí.</span></label>}
        <Button type="button" variant="secondary" disabled={!judgeId || !categoryId} onClick={applyScope}>{assignments.some((item) => item.judgeId === judgeId && item.categoryId === categoryId) ? "Cập nhật phạm vi" : "Thêm phân công"}</Button>
      </div></section>
      <section className="assignment-matrix" aria-label="Ma trận phân công"><div className="section-heading"><div><h2>Ma trận phủ tiêu chí</h2><p>Mỗi ô thể hiện một phân công giữa giám khảo và nhóm sản phẩm.</p></div></div>
        {!judges.length || !categories.length ? <div className="empty-state"><h3>Chưa có nhóm hoặc giám khảo</h3><p>Thêm dữ liệu danh mục và tài khoản giám khảo trước khi phân công.</p></div> : coverage.map(({ category, criteria, assigned, missing }) => <article className="assignment-category" key={category.id}><div className="assignment-category-heading"><div><strong>{category.groupName} · {category.name}</strong><span>{criteria.length ? `${criteria.length - missing.length}/${criteria.length} tiêu chí có người phụ trách` : "Bộ tiêu chí chưa có dữ liệu"}</span></div>{missing.length > 0 && <strong className="coverage-warning">Thiếu phủ {missing.length} tiêu chí</strong>}</div><div className="assignment-judge-grid">{judges.map((judge) => { const item = assigned.find((row) => row.judgeId === judge.id); const scope = item ? item.criterionIds.length ? `${item.criterionIds.length} tiêu chí` : "Toàn bộ tiêu chí" : "Chưa phân công"; const criterionNames = item?.criterionIds.map((id) => criteria.find((criterion) => criterion.id === id)?.code).filter(Boolean).join(", "); return <button type="button" className={`assignment-cell${item ? " is-assigned" : ""}`} key={judge.id} aria-pressed={Boolean(item)} onClick={() => toggleCell(judge, category)}><strong>{judge.fullName}</strong><span>{scope}</span>{criterionNames && <small>{criterionNames}</small>}</button>; })}</div>{missing.length > 0 && <p className="coverage-warning-text">Chưa được giao: {missing.map((item) => `${item.code} ${item.name}`).join(" · ")}</p>}</article>)}
      </section>
      <section className="assignment-preview" aria-live="polite"><h2>Xem trước thay đổi</h2>{dirty ? <><p>{added.length} phân công thêm · {removed.length} phân công gỡ · {scopeChanged.length} phạm vi đổi</p><ul>{[...added.map((item) => `Thêm: ${item.judge.fullName} · ${item.category.groupName} / ${item.category.name}`), ...removed.map((item) => `Gỡ: ${item.judge.fullName} · ${item.category.groupName} / ${item.category.name}`), ...scopeChanged.map((item) => `Đổi phạm vi: ${item.judge.fullName} · ${item.category.groupName} / ${item.category.name}`)].map((change) => <li key={change}>{change}</li>)}</ul></> : <p>Chưa có thay đổi so với danh sách đã lưu.</p>}</section>
      <Button disabled={busy || !dirty} onClick={() => void save()}>{busy ? "Đang thay thế…" : "Xác nhận thay thế toàn bộ phân công"}</Button>
    </>}
  </section>;
}

export function AdminProductsPage() {
  const [page, setPage] = useState(1);
  const { result: response, error, loading } = useApi<AdminProduct[]>(`/admin/products?page=${page}&limit=20`);
  const result: ApiResult<AdminProduct[]> = response ?? { data: [] };
  return <section><p className="eyebrow">QUẢN TRỊ</p><h1>Tất cả hồ sơ</h1>{error && <p role="alert" className="form-note">{error}</p>}{loading && <div className="record-list-skeleton" aria-busy="true" aria-label="Đang tải danh sách hồ sơ">{Array.from({ length: 5 }, (_, index) => <div className="skeleton-block" key={index} />)}</div>}{!loading && !error && <><p>{result.meta?.total ?? result.data.length} hồ sơ</p>{result.data.length ? <div className="record-list">{result.data.map((product) => <article className="record-row" key={product.id}><div className="record-main"><span className="badge">{product.status}</span><h2>{product.name}</h2><p>{product.category.groupName} · {product.category.name}</p><p>{product.registrant.fullName} · {product.registrant.email}</p></div><div className="record-result"><span>{product.evaluations.filter((row) => row.status === "SUBMITTED").length} phiếu</span><Link className="button button-secondary" to="/admin/products/$id" params={{ id: product.id }}>Xem kết quả</Link></div></article>)}</div> : <div className="empty-state"><h2>Chưa có hồ sơ</h2><p>Hồ sơ sẽ xuất hiện sau khi chủ thể nộp đăng ký.</p></div>}<div className="hero-actions"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Trước</Button><span>Trang {page} / {result.meta?.totalPages ?? 1}</span><Button variant="secondary" disabled={page >= (result.meta?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Sau</Button></div></>}</section>;
}

interface ProductResults { id: string; name: string; status: string; finalScore: number | null; starRating: number | null; category: Category; evaluations: { judge: { id: string; fullName: string; email: string }; status: string; total: number | null; scores: { option: { label: string; points: number }; note: string | null; subCriterion: { code: string; criterion: { code: string; name: string } } }[] }[] }

export function AdminProductResultsPage({ productId }: { productId: string }) {
  const { result, error } = useApi<ProductResults>(`/admin/products/${productId}/results`);
  const product = result?.data ?? null;
  if (error) return <section><p role="alert" className="form-note">{error}</p><Link to="/admin/products">Quay lại</Link></section>;
  if (!product) return <p>Đang tải kết quả…</p>;
  return <section><Link className="text-link" to="/admin/products">← Tất cả hồ sơ</Link><p className="eyebrow">{product.category.groupName} · {product.category.name} · {product.status}</p><h1>{product.name}</h1><p><strong>{product.finalScore ?? "Chưa tổng hợp"} {product.finalScore !== null ? `điểm · ${product.starRating} sao` : ""}</strong></p>{product.evaluations.map((evaluation) => <article className="route-panel" key={evaluation.judge.id}><h2>{evaluation.judge.fullName} · {evaluation.status}</h2><p>{evaluation.judge.email} · {evaluation.total ?? "Chưa có tổng điểm"}</p><div className="record-list">{evaluation.scores.map((score, index) => <div className="record-row" key={`${score.subCriterion.code}-${index}`}><div className="record-main"><strong>{score.subCriterion.criterion.code} · {score.subCriterion.criterion.name}</strong><p>{score.subCriterion.code} · {score.option.label}</p>{score.note && <p>{score.note}</p>}</div><strong>{score.option.points} điểm</strong></div>)}</div></article>)}</section>;
}
