import { Link } from "@tanstack/react-router";
import { ADMIN_DASHBOARD_STATUS_LABEL } from "../../constants/product-status";
import { errorText } from "../../lib/api-error";
import { useAdminDashboard } from "../../queries/admin";

export function AdminDashboardPage() {
  const { data = null, isPending: loading, error: loadError } = useAdminDashboard();
  const error = errorText(loadError);

  return <section className="admin-dashboard">
    <div className="section-heading"><div><p className="eyebrow">QUẢN TRỊ OCOP</p><h1>Tổng quan</h1><p className="section-intro">Tiến độ hồ sơ và phiếu chấm theo dữ liệu hệ thống.</p></div></div>
    <nav className="quick-links" aria-label="Lối tắt quản trị"><Link to="/admin/products">Tất cả hồ sơ</Link><Link to="/admin/judges">Quản lý giám khảo</Link><Link to="/admin/assignments">Phân công</Link></nav>
    {loading && <div className="dashboard-skeleton" aria-label="Đang tải tổng quan" aria-busy="true"><div className="skeleton-block" /><div className="skeleton-block" /><div className="skeleton-block" /><div className="skeleton-table" /></div>}
    {error && <div className="empty-state" role="alert"><h2>Chưa tải được tổng quan</h2><p>{error}</p><p>Hãy thử tải lại hoặc mở trực tiếp danh sách hồ sơ.</p><Link to="/admin/products">Mở danh sách hồ sơ</Link></div>}
    {data && <>
      <div className="dashboard-status-grid" aria-label="Hồ sơ theo trạng thái">
        {(Object.keys(ADMIN_DASHBOARD_STATUS_LABEL) as (keyof typeof ADMIN_DASHBOARD_STATUS_LABEL)[]).map((status) => <article className="dashboard-stat" key={status}><span>{ADMIN_DASHBOARD_STATUS_LABEL[status]}</span><strong>{data.productsByStatus[status]}</strong></article>)}
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
