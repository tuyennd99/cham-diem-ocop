import { Link } from "@tanstack/react-router";
import { errorText } from "../../lib/api-error";
import { useAdminProductResults } from "../../queries/admin";

export function AdminProductResultsPage({ productId }: { productId: string }) {
  const { data: product = null, error: loadError } = useAdminProductResults(productId);
  const error = errorText(loadError);
  if (error) return <section><p role="alert" className="form-note">{error}</p><Link to="/admin/products">Quay lại</Link></section>;
  if (!product) return <p>Đang tải kết quả…</p>;
  return <section><Link className="text-link" to="/admin/products">← Tất cả hồ sơ</Link><p className="eyebrow">{product.category.groupName} · {product.category.name} · {product.status}</p><h1>{product.name}</h1><p><strong>{product.finalScore ?? "Chưa tổng hợp"} {product.finalScore !== null ? `điểm · ${product.starRating} sao` : ""}</strong></p>{product.evaluations.map((evaluation) => <article className="route-panel" key={evaluation.judge.id}><h2>{evaluation.judge.fullName} · {evaluation.status}</h2><p>{evaluation.judge.email} · {evaluation.total ?? "Chưa có tổng điểm"}</p><div className="record-list">{evaluation.scores.map((score, index) => <div className="record-row" key={`${score.subCriterion.code}-${index}`}><div className="record-main"><strong>{score.subCriterion.criterion.code} · {score.subCriterion.criterion.name}</strong><p>{score.subCriterion.code} · {score.option.label}</p>{score.note && <p>{score.note}</p>}</div><strong>{score.option.points} điểm</strong></div>)}</div></article>)}</section>;
}
