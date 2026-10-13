import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type FormEvent, type MouseEvent } from "react";
import { getSession, setSession } from "./auth";
import { imageSources, records } from "./data";
import { useDossierFilters } from "./useDossierFilters";
import { DossierFilters } from "./DossierFilters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DossierRecord } from "./types";

type AppRoute = "/" | "/login" | "/register";

let recordOpenedFromList = false;

function routeRecordId(pathname: string) {
  return pathname.match(/^\/products\/([a-z0-9-]+)\/?$/)?.[1] ?? null;
}

function routeFromLocation(pathname: string): AppRoute {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/login" || path === "/register") return path;
  return "/";
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" aria-label={rating + " trên 5 sao"}>
      <span aria-hidden="true">{"★".repeat(rating)}</span>
      <span className="stars-empty" aria-hidden="true">{"☆".repeat(5 - rating)}</span>
    </span>
  );
}

function App() {
  const navigateTo = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const {
    query, setQuery,
    category, setCategory,
    status, setStatus,
    page, setPage, pageSize,
    visibleRecords, pageCount, pageRecords, changeFilters,
  } = useDossierFilters();
  const route = routeFromLocation(pathname);
  const detailId = routeRecordId(pathname);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectedRecord = records.find((record) => record.slug === detailId);

  function navigate(path: string): void {
    void navigateTo({ href: path, resetScroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitMockAuth(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSession({ role: "PRODUCER" });
    navigate("/my/products/new");
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (detailId && !dialog.open) dialog.showModal();
    if (!detailId && dialog.open) dialog.close();
  }, [detailId]);

  function openRecord(event: MouseEvent<HTMLAnchorElement>, record: DossierRecord): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    recordOpenedFromList = true;
    void navigateTo({ href: "/products/" + record.slug, resetScroll: false });
  }

  function closeRecord(): void {
    if (!detailId) return;
    if (recordOpenedFromList) {
      recordOpenedFromList = false;
      window.history.back();
    } else {
      void navigateTo({ href: "/#lookup", replace: true, resetScroll: false });
    }
  }

  return (
    <>
      {route === "/" ? <main id="content" className={pathname === "/products" ? "products-index" : undefined}>
        <section className="hero section" id="home" aria-labelledby="hero-title">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">ĐĂNG KÝ · CHẤM ĐIỂM · XẾP HẠNG</p>
              <h1 id="hero-title">Theo dõi hồ sơ OCOP trong một nơi</h1>
              <p className="lead">Tra cứu thông tin sản phẩm, trạng thái xử lý và kết quả xếp hạng qua một danh sách hồ sơ thống nhất.</p>
              <div className="hero-actions">
                <Link className="button button-primary" to={getSession() ? "/my/products/new" : "/register"}>Đăng ký sản phẩm</Link>
                <a className="button button-secondary" href="#workflow">Cách chấm điểm</a>
              </div>
              <p className="sample-inline">Các hồ sơ trên trang là dữ liệu minh họa, không phải hồ sơ thật.</p>
            </div>
            <aside className="hero-aside" aria-label="Thông tin về dữ liệu hiển thị">
              <p className="eyebrow">THÔNG TIN TRA CỨU</p>
              <h2>Mỗi hồ sơ có một trạng thái chung</h2>
              <p>Tiến độ và số sao được hiển thị từ cùng một bản ghi. Hồ sơ chưa có kết quả sẽ không hiện hạng sao.</p>
              <a className="text-link" href="#criteria">Xem nhóm tiêu chí và ngưỡng sao <span aria-hidden="true">→</span></a>
            </aside>
          </div>
        </section>

        <section className="section lookup-section" id="lookup" aria-labelledby="lookup-title">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">TRA CỨU CÔNG KHAI · DỮ LIỆU MẪU</p>
                <h2 id="lookup-title">Danh sách hồ sơ OCOP</h2>
              </div>
              <p className="section-intro">Tìm theo tên sản phẩm, mã hồ sơ, đơn vị hoặc địa phương. Mỗi kết quả bao gồm nhóm, trạng thái và hạng sao nếu đã có.</p>
            </div>

            <DossierFilters
              query={query}
              category={category}
              status={status}
              onQueryChange={(value) => changeFilters(() => setQuery(value))}
              onCategoryChange={(value) => changeFilters(() => setCategory(value))}
              onStatusChange={(value) => changeFilters(() => setStatus(value))}
            />

            <p className="result-count" aria-live="polite">
              {visibleRecords.length ? "Đang hiển thị " + ((page - 1) * pageSize + 1) + "–" + Math.min(page * pageSize, visibleRecords.length) + " trong " + visibleRecords.length + " hồ sơ minh họa." : "Không có hồ sơ phù hợp. Hãy đổi từ khóa hoặc bộ lọc."}
            </p>

            {visibleRecords.length ? (
              <div className="record-list" aria-label="Kết quả tra cứu">
                {pageRecords.map((record) => (
                  <Card as="article" className="record-row" key={record.id}>
                    <div className="record-media" style={{ aspectRatio: `${record.width} / ${record.height}` }}>
                      <img src={record.image} alt={record.alt} width={record.width} height={record.height} loading="lazy" decoding="async" />
                    </div>
                    <div className="record-main">
                      <div className="record-badges">
                        <span className="badge badge-category">{record.categoryLabel}</span>
                        <span className={"badge status-badge status-" + record.status}>{record.statusLabel}</span>
                      </div>
                      <h3>{record.name}</h3>
                      <p className="record-origin">{record.origin}</p>
                      <dl className="record-facts">
                        <div><dt>Mã hồ sơ</dt><dd>{record.id}</dd></div>
                        <div><dt>Đơn vị</dt><dd>{record.applicant}</dd></div>
                      </dl>
                    </div>
                    <div className="record-result">
                      {record.rating ? (
                        <div className="rating-block">
                          <strong>{record.rating} sao</strong>
                          <Stars rating={record.rating} />
                        </div>
                      ) : <p className="no-rating">Chưa có kết quả xếp hạng</p>}
                      <Link className="button button-secondary detail-link" to="/products/$id" params={{ id: record.slug }} onClick={(event) => openRecord(event, record)} aria-label={"Xem hồ sơ " + record.id + ", " + record.name}>Xem hồ sơ</Link>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="empty-state"><h3>Chưa tìm thấy hồ sơ</h3><p>Thử từ khóa khác hoặc chọn lại nhóm sản phẩm và trạng thái.</p></div>
            )}

            {visibleRecords.length > pageSize && (
              <nav className="pagination" aria-label="Phân trang hồ sơ">
                <Button type="button" variant="secondary" className="button button-secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Trang trước</Button>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                  <Button key={pageNumber} type="button" variant={page === pageNumber ? "primary" : "secondary"} className={page === pageNumber ? "page-number current" : "page-number"} aria-current={page === pageNumber ? "page" : undefined} aria-label={"Trang " + pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</Button>
                ))}
                <span className="page-count" aria-live="polite">Trang {page} / {pageCount}</span>
                <Button type="button" variant="secondary" className="button button-secondary" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount}>Trang sau</Button>
              </nav>
            )}

            <details className="image-sources">
              <summary>Nguồn ảnh sản phẩm</summary>
              <ul>{imageSources.map(([label, url]) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{label}</a></li>)}</ul>
            </details>
          </div>
        </section>

        <section className="section workflow-section" id="workflow" aria-labelledby="workflow-title">
          <div className="container">
            <div className="section-heading section-heading-narrow">
              <div><p className="eyebrow">QUY TRÌNH TRÊN HỆ THỐNG</p><h2 id="workflow-title">Từ hồ sơ đến kết quả xếp hạng</h2></div>
              <p className="section-intro">Ba bước mô tả luồng xử lý trong phần mềm, không phải các cấp hành chính hay những vòng đánh giá riêng.</p>
            </div>
            <div className="steps-grid">
              <article className="step-item">
                <span className="step-number">01</span>
                <h3>Gửi hồ sơ</h3>
                <p>Chủ thể đăng ký gửi thông tin sản phẩm và tài liệu tự đánh giá lên hệ thống.</p>
              </article>
              <article className="step-item">
                <span className="step-number">02</span>
                <h3>Phân công giám khảo</h3>
                <p>Hệ thống phân công giám khảo. Mỗi người chấm theo bộ tiêu chí và nộp phiếu đánh giá.</p>
              </article>
              <article className="step-item">
                <span className="step-number">03</span>
                <h3>Tổng hợp và xếp sao</h3>
                <p>Khi đã nhận đủ phiếu, hệ thống tính điểm trung bình và đối chiếu ngưỡng để xác định hạng sao.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section criteria-section" id="criteria" aria-labelledby="criteria-title">
          <div className="container">
            <div className="section-heading section-heading-narrow">
              <div><p className="eyebrow">THANG ĐIỂM · QUYẾT ĐỊNH 26/2026/QĐ-TTg</p><h2 id="criteria-title">Ba nhóm tiêu chí, tối đa 100 điểm</h2></div>
              <p className="section-intro">Giám khảo chấm theo các tiêu chí và tiểu mục áp dụng cho nhóm sản phẩm. Điểm cuối được tổng hợp từ các phiếu hợp lệ.</p>
            </div>
            <div className="criteria-grid">
              <article className="criteria-item">
                <p className="eyebrow">NHÓM A</p>
                <h3>Sản phẩm và sức mạnh cộng đồng</h3>
                <strong className="criteria-score">40 <span>điểm</span></strong>
                <ul><li>Tổ chức sản xuất</li><li>Phát triển sản phẩm</li><li>Sức mạnh cộng đồng</li></ul>
              </article>
              <article className="criteria-item">
                <p className="eyebrow">NHÓM B</p>
                <h3>Khả năng tiếp thị</h3>
                <strong className="criteria-score">25 <span>điểm</span></strong>
                <ul><li>Tiếp thị</li><li>Câu chuyện sản phẩm</li></ul>
              </article>
              <article className="criteria-item">
                <p className="eyebrow">NHÓM C</p>
                <h3>Chất lượng sản phẩm</h3>
                <strong className="criteria-score">35 <span>điểm</span></strong>
                <ul><li>Cảm quan, dinh dưỡng và tính độc đáo</li><li>Công bố và bảo đảm chất lượng</li><li>Hướng dẫn sử dụng và cơ hội thị trường</li></ul>
              </article>
            </div>
            <h3 className="bands-title">Ngưỡng xếp hạng theo tổng điểm</h3>
            <div className="star-bands" aria-label="Ngưỡng tổng điểm theo hạng sao">
              <div><strong>5 sao</strong><span>90–100 điểm</span></div>
              <div><strong>4 sao</strong><span>70 đến dưới 90</span></div>
              <div><strong>3 sao</strong><span>50 đến dưới 70</span></div>
              <div><strong>2 sao</strong><span>30 đến dưới 50</span></div>
              <div><strong>1 sao</strong><span>Dưới 30 điểm</span></div>
            </div>
            <p className="score-note">Điểm thành phần cụ thể phụ thuộc nhóm và phân nhóm sản phẩm trong phụ lục của Quyết định.</p>
            <a className="text-link source-link" href="https://xaydungchinhsach.chinhphu.vn/quyet-dinh-so-26-2026-qd-ttg-bo-tieu-chi-va-quy-trinh-danh-gia-phan-hang-san-pham-ocop-119260529164111182.htm" target="_blank" rel="noreferrer">Xem hướng dẫn Quyết định 26/2026/QĐ-TTg <span aria-hidden="true">↗</span></a>
          </div>
        </section>

        <section className="closing-section">
          <div className="container closing-inner">
            <div><p className="eyebrow">TRA CỨU HỒ SƠ OCOP</p><h2>Trạng thái và kết quả trong cùng một danh sách</h2></div>
            <a className="button button-primary" href="#lookup">Mở danh sách hồ sơ</a>
          </div>
        </section>
      </main> : <main className="route-main" id="content">
        <div className="container route-container">
          {route === "/login" && <section className="route-panel" aria-labelledby="route-title">
            <p className="eyebrow">TÀI KHOẢN · BẢN MẪU</p><h1 id="route-title">Đăng nhập</h1>
            <p className="route-intro">Đăng nhập mô phỏng để tiếp tục tạo hồ sơ sản phẩm.</p>
            <form className="account-form" onSubmit={submitMockAuth}>
              <label>Email<Input type="email" name="email" autoComplete="email" required /></label>
              <label>Mật khẩu<Input type="password" name="password" autoComplete="current-password" required /></label>
              <Button className="button button-primary" type="submit">Đăng nhập</Button>
            </form>
            <p className="form-note">Giao diện mô phỏng, chưa xác thực tài khoản.</p>
            <p>Chưa có tài khoản? <Link className="text-link" to="/register">Đăng ký</Link></p>
          </section>}
          {route === "/register" && <section className="route-panel" aria-labelledby="route-title">
            <p className="eyebrow">TÀI KHOẢN · BẢN MẪU</p><h1 id="route-title">Đăng ký tài khoản</h1>
            <p className="route-intro">Tạo tài khoản minh họa để chuyển tới form tạo hồ sơ.</p>
            <form className="account-form" onSubmit={submitMockAuth}>
              <label>Tên chủ thể<Input type="text" name="name" autoComplete="organization" required /></label>
              <label>Email<Input type="email" name="email" autoComplete="email" required /></label>
              <label>Mật khẩu<Input type="password" name="password" autoComplete="new-password" required /></label>
              <Button className="button button-primary" type="submit">Tạo tài khoản mẫu</Button>
            </form>
            <p className="form-note">Thông tin chỉ dùng trong giao diện và không được gửi hoặc lưu.</p>
            <p>Đã có tài khoản? <Link className="text-link" to="/login">Đăng nhập</Link></p>
          </section>}
        </div>
      </main>}

      <Dialog ref={dialogRef} className="record-dialog" aria-labelledby="detail-title" onCancel={(event) => { event.preventDefault(); closeRecord(); }} onClick={(event) => { if (event.target === event.currentTarget) closeRecord(); }}>
        <div className="dialog-inner">
          <div className="dialog-heading">
            <div><p className="eyebrow">CHI TIẾT HỒ SƠ · DỮ LIỆU MẪU</p><h2 id="detail-title">{selectedRecord ? selectedRecord.name : "Không tìm thấy hồ sơ"}</h2></div>
            <button className="icon-button" type="button" aria-label="Đóng chi tiết hồ sơ" onClick={closeRecord}>×</button>
          </div>
          {selectedRecord ? (
            <>
              <div className="detail-layout">
                <div className="detail-media" style={{ aspectRatio: `${selectedRecord.width} / ${selectedRecord.height}` }}><img src={selectedRecord.image} alt={selectedRecord.alt} width={selectedRecord.width} height={selectedRecord.height} /></div>
                <div>
                  <p className="detail-note">{selectedRecord.note}</p>
                  <dl className="detail-facts">
                    <div><dt>Mã hồ sơ</dt><dd>{selectedRecord.id}</dd></div>
                    <div><dt>Sản phẩm</dt><dd>{selectedRecord.name}</dd></div>
                    <div><dt>Nhóm</dt><dd>{selectedRecord.categoryLabel}</dd></div>
                    <div><dt>Đơn vị minh họa</dt><dd>{selectedRecord.applicant}</dd></div>
                    <div><dt>Địa phương</dt><dd>{selectedRecord.origin}</dd></div>
                    <div><dt>Bước xử lý</dt><dd>{selectedRecord.stage}</dd></div>
                    <div><dt>Cập nhật mẫu</dt><dd>{selectedRecord.updated}</dd></div>
                    <div><dt>Trạng thái</dt><dd>{selectedRecord.statusLabel}</dd></div>
                    <div><dt>Kết quả</dt><dd>{selectedRecord.rating ? selectedRecord.rating + " sao" : "Chưa có kết quả xếp hạng"}</dd></div>
                  </dl>
                </div>
              </div>
              <p className="dialog-disclaimer">Bản mẫu chỉ hiển thị dữ liệu công khai minh họa; không chứa hồ sơ thật hoặc thông tin cá nhân.</p>
            </>
          ) : <p className="detail-note">Đường dẫn này không khớp với hồ sơ công khai trong dữ liệu mẫu.</p>}
          <button className="button button-primary" type="button" onClick={closeRecord}>Đóng chi tiết</button>
        </div>
      </Dialog>
    </>
  );
}

export default App;
