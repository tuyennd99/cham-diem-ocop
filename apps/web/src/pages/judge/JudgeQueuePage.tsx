import { Link } from "@tanstack/react-router";
import { errorText } from "../../lib/api-error";
import { useJudgeQueue } from "../../queries/judge";

export function JudgeQueuePage() {
  const { data: rows = [], error: loadError, isPending: loading } = useJudgeQueue();
  const error = errorText(loadError);
  return <section><div className="section-heading"><div><p className="eyebrow">KHU VỰC GIÁM KHẢO</p><h1>Hàng chờ chấm</h1></div></div>{loading && <div className="record-list-skeleton" aria-busy="true" aria-label="Đang tải hàng chờ">{Array.from({ length: 4 }, (_, index) => <div className="record-row skeleton-record" key={index}><div className="skeleton-media" /><div className="skeleton-copy"><div className="skeleton-line" /><div className="skeleton-line short" /></div></div>)}</div>}{error && <p className="form-note" role="alert">{error}</p>}{!loading && !error && !rows.length && <div className="empty-state"><h2>Chưa có hồ sơ được phân công</h2><p>Các hồ sơ sẽ xuất hiện tại đây khi được nộp và phân công.</p></div>}{!loading && !error && <div className="record-list">{rows.map((row) => <article className="record-row" key={row.id}><div className="record-main"><div className="record-badges"><span className="badge badge-category">{row.category.groupName} · {row.category.name}</span><span className="badge">{row.status}</span></div><h2>{row.name}</h2><p>{row.description}</p><p>{row.evaluations[0]?.status === "SUBMITTED" ? `Đã nộp phiếu · ${row.evaluations[0].total ?? 0} điểm` : "Phiếu chấm đang mở"}</p></div><div className="record-result"><span>{row.attachments.length} ảnh</span><Link className="button button-secondary" to="/judge/products/$id" params={{ id: row.id }}>Mở phiếu</Link></div></article>)}</div>}</section>;
}
