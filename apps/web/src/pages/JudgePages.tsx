import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { api, messageOf } from "../lib/api";
import type { ScoreOption } from "@ocop/shared";
import { Button } from "@/components/ui/button";
import { openAttachment } from "../lib/attachments";
import { useApi } from "../lib/use-api";
import { formatFormEntries } from "../lib/utils";
import type { EvaluationData, QueueProduct } from "../types/judge";

export function JudgeQueuePage() {
  const { result, error, loading } = useApi<QueueProduct[]>("/judge/products");
  const rows = result?.data ?? [];
  return <section><div className="section-heading"><div><p className="eyebrow">KHU VỰC GIÁM KHẢO</p><h1>Hàng chờ chấm</h1></div></div>{loading && <div className="record-list-skeleton" aria-busy="true" aria-label="Đang tải hàng chờ">{Array.from({ length: 4 }, (_, index) => <div className="record-row skeleton-record" key={index}><div className="skeleton-media" /><div className="skeleton-copy"><div className="skeleton-line" /><div className="skeleton-line short" /></div></div>)}</div>}{error && <p className="form-note" role="alert">{error}</p>}{!loading && !error && !rows.length && <div className="empty-state"><h2>Chưa có hồ sơ được phân công</h2><p>Các hồ sơ sẽ xuất hiện tại đây khi được nộp và phân công.</p></div>}{!loading && !error && <div className="record-list">{rows.map((row) => <article className="record-row" key={row.id}><div className="record-main"><div className="record-badges"><span className="badge badge-category">{row.category.groupName} · {row.category.name}</span><span className="badge">{row.status}</span></div><h2>{row.name}</h2><p>{row.description}</p><p>{row.evaluations[0]?.status === "SUBMITTED" ? `Đã nộp phiếu · ${row.evaluations[0].total ?? 0} điểm` : "Phiếu chấm đang mở"}</p></div><div className="record-result"><span>{row.attachments.length} ảnh</span><Link className="button button-secondary" to="/judge/products/$id" params={{ id: row.id }}>Mở phiếu</Link></div></article>)}</div>}</section>;
}

export function JudgeEvaluationPage({ productId }: { productId: string }) {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [activeCriterionId, setActiveCriterionId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; api<EvaluationData>(`/judge/products/${productId}/evaluation`).then(({ data: result }) => {
    if (!active) return; setData(result);
    const selectedOptions: Record<string, string> = {}; const savedNotes: Record<string, string> = {};
    for (const score of result.evaluation.scores) { selectedOptions[score.subCriterionId] = score.optionId; savedNotes[score.subCriterionId] = score.note ?? ""; }
    setSelected(selectedOptions); setNotes(savedNotes); setActiveCriterionId(result.criteria[0]?.id ?? "");
  }).catch((e) => { if (active) setError(messageOf(e)); }); return () => { active = false; }; }, [productId]);
  const subcriteria = useMemo(() => data?.criteria.flatMap((criterion) => criterion.subCriteria) ?? [], [data]);
  const total = subcriteria.reduce((sum, sub) => sum + (sub.options.find((item) => item.id === selected[sub.id])?.points ?? 0), 0);
  const completedCriteria = data?.criteria.filter((criterion) => criterion.subCriteria.length > 0 && criterion.subCriteria.every((sub) => Boolean(selected[sub.id]))).length ?? 0;
  const activeIndex = data?.criteria.findIndex((criterion) => criterion.id === activeCriterionId) ?? -1;
  const activeCriterion = activeIndex >= 0 ? data?.criteria[activeIndex] : undefined;
  const completed = subcriteria.filter((sub) => Boolean(selected[sub.id])).length;
  async function save() {
    if (!data) return; setBusy(true); setError(""); setNotice("");
    try {
      const scores = Object.entries(selected).map(([subCriterionId, optionId]) => ({ subCriterionId, optionId, ...(notes[subCriterionId] ? { note: notes[subCriterionId] } : {}) }));
      await api(`/judge/products/${productId}/evaluation`, { method: "PUT", body: JSON.stringify({ scores }) }); setNotice("Đã lưu bản chấm.");
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (Object.keys(selected).length !== subcriteria.length) { setError("Chọn mức điểm cho mọi tiểu tiêu chí trước khi nộp."); return; }
    if (!window.confirm("Nộp phiếu chấm? Sau khi nộp, phiếu sẽ chuyển sang chỉ đọc.")) return;
    setBusy(true); setError(""); try {
      const scores = Object.entries(selected).map(([subCriterionId, optionId]) => ({ subCriterionId, optionId, ...(notes[subCriterionId] ? { note: notes[subCriterionId] } : {}) }));
      await api(`/judge/products/${productId}/evaluation`, { method: "PUT", body: JSON.stringify({ scores }) });
      const { data: result } = await api<{ status: string; total: number }>(`/judge/products/${productId}/evaluation/submit`, { method: "POST" }); setData((current) => current ? { ...current, evaluation: { ...current.evaluation, status: result.status, total: result.total } } : current); setNotice("Đã nộp phiếu chấm.");
    }
    catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  if (error && !data) return <section><h1>Phiếu chấm</h1><div className="empty-state" role="alert"><h2>Chưa tải được phiếu chấm</h2><p>{error}</p><Link to="/judge">Quay lại hàng chờ</Link></div></section>;
  if (!data) return <section className="judge-workspace-skeleton" aria-busy="true" aria-label="Đang tải phiếu chấm"><div className="skeleton-block" /><div className="skeleton-block" /><div className="skeleton-block" /></section>;
  const locked = data.evaluation.status === "SUBMITTED";
  const sections = [
    { key: "A", label: "A. Sản phẩm và sức mạnh cộng đồng" },
    { key: "B", label: "B. Khả năng tiếp thị" },
    { key: "C", label: "C. Chất lượng sản phẩm" },
    { key: "other", label: "Tiêu chí được phân công" },
  ];
  const entries = formatFormEntries(data.product.formData);
  const entityKeys = new Set(["entityName", "representativeName", "representativeTitle", "contactAddress", "provinceName", "phone", "email"]);
  const renderFormSection = (title: string, rows: typeof entries) => <details className="judge-details"><summary>{title}</summary><dl className="detail-facts">{rows.map((row) => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></details>;

  return <section className="judge-page">
    <div className="judge-page-header"><div><Link className="text-link" to="/judge">← Hàng chờ chấm</Link><p className="eyebrow">{data.product.category.groupName} · {data.product.category.name}</p><h1>{data.product.name}</h1><p>Mã hồ sơ <code>{data.product.id}</code></p></div><span className={`badge ${locked ? "status-completed" : "badge-category"}`}>{locked ? "Đã nộp · chỉ đọc" : "Phiếu nháp"}</span></div>
    {locked && <p className="form-note">Phiếu đã nộp và không thể chỉnh sửa.</p>}
    <div className="judge-workspace">
      <aside className="judge-criteria-nav" aria-label="Điều hướng tiêu chí"><div className="criteria-progress"><strong>{completedCriteria}/{data.criteria.length} tiêu chí đã chọn đủ</strong><div className="progress-track" role="progressbar" aria-label="Tiến độ tiêu chí" aria-valuemin={0} aria-valuemax={data.criteria.length} aria-valuenow={completedCriteria}><span style={{ width: `${data.criteria.length ? completedCriteria / data.criteria.length * 100 : 0}%` }} /></div></div>
        {sections.map((section) => { const items = data.criteria.filter((criterion) => section.key === "other" ? !/^[ABC]/i.test(criterion.code) : criterion.code.toUpperCase().startsWith(section.key)); return items.length ? <div className="criteria-nav-group" key={section.key}><h2>{section.label}</h2>{items.map((criterion) => { const done = criterion.subCriteria.length > 0 && criterion.subCriteria.every((sub) => Boolean(selected[sub.id])); const score = criterion.subCriteria.reduce((sum, sub) => sum + (sub.options.find((option) => option.id === selected[sub.id])?.points ?? 0), 0); return <button type="button" className={`criterion-nav-item${criterion.id === activeCriterionId ? " is-current" : ""}`} key={criterion.id} aria-current={criterion.id === activeCriterionId ? "step" : undefined} onClick={() => setActiveCriterionId(criterion.id)}><span className="criterion-nav-name">{criterion.code}. {criterion.name}</span><span className="criterion-nav-meta"><span>{score}/{criterion.maxScore}</span><span>{done ? "✓ Đã chấm" : "Chưa chấm"}</span></span></button>; })}</div> : null; })}
      </aside>
      <main className="judge-scoring-main"><div className="criteria-summary"><div><p className="eyebrow">TIÊU CHÍ {activeIndex + 1} / {data.criteria.length}</p><h2>{activeCriterion ? `${activeCriterion.code} — ${activeCriterion.name}` : "Chưa có tiêu chí được phân công"}</h2></div>{activeCriterion && <span className="badge badge-category">Tối đa {activeCriterion.maxScore} điểm</span>}</div>
        {activeCriterion ? <div className="subcriteria-list">{activeCriterion.subCriteria.map((sub) => <fieldset className="score-card" key={sub.id} disabled={locked}><legend>{sub.content}</legend><div className="score-options">{sub.options.map((option: ScoreOption) => <label className={`score-option${selected[sub.id] === option.id ? " is-selected" : ""}`} key={option.id}><input type="radio" name={`score-${sub.id}`} value={option.id} checked={selected[sub.id] === option.id} onChange={() => { setSelected((current) => ({ ...current, [sub.id]: option.id })); setNotice(""); setError(""); }} /><span>{option.label}</span><strong>{option.points} điểm</strong></label>)}</div><details className="judge-note"><summary>Ghi chú của giám khảo</summary><label htmlFor={`note-${sub.id}`}>Ghi chú (không bắt buộc)</label><textarea id={`note-${sub.id}`} rows={3} maxLength={2000} value={notes[sub.id] ?? ""} onChange={(event) => { setNotes((current) => ({ ...current, [sub.id]: event.target.value })); setNotice(""); }} /></details></fieldset>)}</div> : <div className="empty-state"><p>Chưa có tiêu chí nào được phân công cho phiếu này.</p></div>}
        <div className="judge-criterion-nav"><Button variant="secondary" disabled={activeIndex <= 0} onClick={() => setActiveCriterionId(data.criteria[activeIndex - 1]?.id ?? "")}>← Tiêu chí trước</Button><span>{completed}/{subcriteria.length} tiểu tiêu chí đã chọn</span><Button variant="secondary" disabled={activeIndex < 0 || activeIndex >= data.criteria.length - 1} onClick={() => setActiveCriterionId(data.criteria[activeIndex + 1]?.id ?? "")}>Tiêu chí tiếp theo →</Button></div>
      </main>
      <aside className="judge-evidence-panel" aria-label="Thông tin sản phẩm và minh chứng"><h2>Minh chứng hồ sơ</h2><div className="evidence-gallery">{data.product.attachments.filter((file) => file.type === "IMAGE").map((file) => <button type="button" className="evidence-thumb" key={file.id} onClick={() => void openJudgeAttachment(productId, file.id, file.fileName)} aria-label={`Mở ảnh ${file.fileName}`}><span>{file.fileName}</span></button>)}</div>
        <article className="product-summary"><span className="badge badge-category">{data.product.category.groupName} · {data.product.category.name}</span><h3>{data.product.name}</h3><p>{String(data.product.formData.entityName ?? "Chưa có thông tin chủ thể")}</p><p>Mã hồ sơ <code>{data.product.id}</code></p></article>
        {renderFormSection("Thông tin chủ thể", entries.filter((row) => entityKeys.has(row.key)))}
        {renderFormSection("Thông tin sản phẩm (Mẫu 01)", entries.filter((row) => !entityKeys.has(row.key)))}
        <section className="evidence-files"><h3>Tệp minh chứng</h3>{data.product.attachments.filter((file) => file.type !== "IMAGE").length ? <ul>{data.product.attachments.filter((file) => file.type !== "IMAGE").map((file) => <li key={file.id}><button type="button" onClick={() => void openJudgeAttachment(productId, file.id, file.fileName)}>{/\.pdf$/i.test(file.fileName) ? "PDF · " : "Tệp · "}{file.fileName}</button></li>)}</ul> : <p>Không có tệp minh chứng bổ sung.</p>}</section>
      </aside>
    </div>
    <footer className="judge-submit-bar"><div className="judge-score-total"><strong aria-live="polite">{total}</strong><span>/ {subcriteria.reduce((sum, sub) => sum + Math.max(0, ...sub.options.map((option) => option.points)), 0)} điểm tạm tính</span></div><span className="autosave-state" role="status">{notice || (locked ? "Phiếu đã nộp" : "Bản nháp chưa lưu")}</span>{error && <p className="form-note" role="alert">{error}</p>}{!locked && <div className="judge-submit-actions"><Button variant="secondary" disabled={busy} onClick={() => void save()}>{busy ? "Đang lưu…" : "Lưu nháp"}</Button><Button disabled={busy || !data.criteria.length} onClick={() => void submit()}>{busy ? "Đang nộp…" : "Nộp phiếu chấm"}</Button></div>}</footer>
  </section>;
}

function openJudgeAttachment(productId: string, attachmentId: string, fileName: string) {
  return openAttachment(`/judge/products/${productId}/attachments/${attachmentId}`, fileName)
    .catch((cause) => window.alert(messageOf(cause)));
}
